import { expect, test } from 'bun:test';
import type { ServerUpdatedEvent } from '@grotto/api';
import { subscribeToServerUpdates } from '../src/grotto-api/server-events.ts';
import { agentCreationFixture } from './agent-creation-fixture.ts';

const fixture = agentCreationFixture();

test('one Agent creating another writes the Message, the Agent, the Thread, and the events', async () => {
    const runner = await fixture.mintRunner('run_create_happy');
    const head = await fixture.owner.trpc.chat.eventHead.query({ serverId: fixture.serverId });
    const updates = watchServerUpdates();

    const created = await fixture.postCreate(
        runner,
        fixture.createBody({ displayName: 'Scout', nonce: 'create-happy' })
    );

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
        agent: {
            avatarUrl: null,
            description: 'Watches the delivery lane.',
            displayName: 'Scout',
            handle: 'scout',
            retired: false,
        },
        avatar: { status: 'none' },
        chatId: fixture.channelId,
        computerId: fixture.computerId,
        idempotent: false,
        modelId: 'gpt-5.6-sol',
        reasoningEffort: 'medium',
        runtimeId: 'codex',
        target: '#product',
    });

    const agentId = created.body.agent?.agentId ?? '';
    expect(await fixture.readAgentRow(agentId)).toMatchObject({
        computer_id: fixture.computerId,
        created_by_agent_id: fixture.orbitAgentId,
        created_by_user_id: null,
        creation_message_id: created.body.messageId,
        desired_model_id: 'gpt-5.6-sol',
        desired_reasoning_effort: 'medium',
        desired_runtime_id: 'codex',
    });

    const threadChatId = `cht_thr_${(created.body.messageId ?? '').slice('msg_'.length)}`;
    const [thread] = (await fixture.harness.sql`
        select anchor_message_id, parent_chat_id from chats where id = ${threadChatId}
    `) as { anchor_message_id: string; parent_chat_id: string }[];
    expect(thread).toMatchObject({
        anchor_message_id: created.body.messageId,
        parent_chat_id: fixture.channelId,
    });

    const events = await fixture.owner.trpc.chat.events.query({
        afterCursor: head.cursor,
        serverId: fixture.serverId,
    });
    // The announcement, then the `#all` membership the Server guarantees every
    // Agent — the same lifecycle event a human's channel save emits.
    expect(events.map((event) => event.type)).toEqual(['message.created', 'chat.lifecycle']);

    const page = await fixture.owner.trpc.chat.messages.query({
        chatId: fixture.channelId,
        limit: 50,
        serverId: fixture.serverId,
    });
    const message = page.messages.find((row) => row.id === created.body.messageId);
    // The announcement's `@scout` is stored as a stable Agent reference, so the
    // mention chip in the transcript is what opens the new Agent's profile.
    expect(message?.content).toBe(
        `Bringing on [@scout](agent://${agentId}) for the delivery lane.`
    );
    expect(message?.body).toEqual({
        agent: {
            agentId,
            avatarUrl: null,
            description: 'Watches the delivery lane.',
            displayName: 'Scout',
            handle: 'scout',
            retired: false,
        },
        kind: 'agent-created',
    });

    expect(await updates.next()).toMatchObject({
        agentId,
        scope: 'agent',
        serverId: fixture.serverId,
    });
    updates.stop();
});

test('the Agent API projects the created Agent onto its Message', async () => {
    const runner = await fixture.mintRunner('run_create_view');
    const created = await fixture.postCreate(
        runner,
        fixture.createBody({ displayName: 'Lookout', nonce: 'create-view' })
    );
    expect(created.status).toBe(200);

    const response = await fetch(
        new URL(`/api/agent/messages/${created.body.messageId}`, fixture.harness.url),
        { headers: { authorization: `Bearer ${runner.token}` } }
    );
    const body = (await response.json()) as {
        message: { agent_created?: Record<string, unknown>; body_kind: string };
    };
    expect(body.message.body_kind).toBe('agent-created');
    expect(body.message.agent_created).toEqual({
        agent_id: created.body.agent?.agentId,
        description: 'Watches the delivery lane.',
        display_name: 'Lookout',
        handle: 'lookout',
        retired: false,
    });
});

test('a replayed nonce returns the same Agent and creates nothing new', async () => {
    const runner = await fixture.mintRunner('run_create_replay');
    const body = fixture.createBody({ displayName: 'Echo', nonce: 'create-replay' });

    const first = await fixture.postCreate(runner, body);
    expect(first.status).toBe(200);
    const second = await fixture.postCreate(runner, body);

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
        agent: { agentId: first.body.agent?.agentId },
        idempotent: true,
        messageId: first.body.messageId,
    });
    expect(await countAgentsNamed('Echo')).toBe(1);
});

test('a reused nonce with different values is refused as a conflict', async () => {
    const runner = await fixture.mintRunner('run_create_conflict');
    const first = await fixture.postCreate(
        runner,
        fixture.createBody({ displayName: 'Tally', nonce: 'create-conflict' })
    );
    expect(first.status).toBe(200);

    const conflict = await fixture.postCreate(
        runner,
        fixture.createBody({ displayName: 'Tally Two', nonce: 'create-conflict' })
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({ code: 'AGENT_CREATE_IDEMPOTENCY_CONFLICT' });
    expect(await countAgentsNamed('Tally Two')).toBe(0);
});

test('a Thread target creates the Agent inside the Thread', async () => {
    const anchorRunner = await fixture.mintRunner('run_create_thread_anchor');
    const anchor = await fixture.postCreate(
        anchorRunner,
        fixture.createBody({ displayName: 'Anchorite', nonce: 'create-thread-anchor' })
    );
    expect(anchor.status).toBe(200);
    const anchorMessageId = anchor.body.messageId ?? '';
    const threadChatId = `cht_thr_${anchorMessageId.slice('msg_'.length)}`;
    const runner = await fixture.mintRunner(
        'run_create_thread',
        fixture.orbitAgentId,
        threadChatId
    );

    const created = await fixture.postCreate(
        runner,
        fixture.createBody({
            displayName: 'Threadling',
            nonce: 'create-thread',
            target: `#product:${anchorMessageId.slice('msg_'.length)}`,
        })
    );

    expect(created.status).toBe(200);
    expect(created.body.chatId).toBe(threadChatId);
});

test('an archived target refuses the creation', async () => {
    const archived = await fixture.owner.trpc.chat.createChannel.mutate({
        agentIds: [fixture.orbitAgentId],
        name: 'retired-lane',
        serverId: fixture.serverId,
    });
    await fixture.owner.trpc.chat.archiveChannel.mutate({
        chatId: archived.id,
        serverId: fixture.serverId,
    });
    const runner = await fixture.mintRunner(
        'run_create_archived',
        fixture.orbitAgentId,
        archived.id
    );

    const refused = await fixture.postCreate(
        runner,
        fixture.createBody({
            displayName: 'Archived',
            nonce: 'create-archived',
            target: '#retired-lane',
        })
    );

    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: 'TARGET_READ_ONLY' });
    expect(await countAgentsNamed('Archived')).toBe(0);
});

// Last, because the gate stays closed for this Chat until the Agent reads it again.
test('a Chat that moved since the Agent last read it refuses the creation', async () => {
    const runner = await fixture.mintRunner('run_create_stale');
    await fixture.owner.trpc.chat.send.mutate({
        chatId: fixture.channelId,
        content: 'One more thing before you hire.',
        nonce: 'create-stale-human',
        serverId: fixture.serverId,
    });

    const stale = await fixture.postCreate(
        runner,
        fixture.createBody({ displayName: 'Stale', nonce: 'create-stale' })
    );
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: 'CHAT_VIEW_STALE' });
    expect(await countAgentsNamed('Stale')).toBe(0);
});

async function countAgentsNamed(displayName: string) {
    const [row] = (await fixture.harness.sql`
        select count(*)::int as total from agents
        where server_id = ${fixture.serverId} and display_name = ${displayName}
    `) as { total: number }[];
    return row.total;
}

function watchServerUpdates() {
    const controller = new AbortController();
    const iterator = subscribeToServerUpdates(controller.signal)[Symbol.asyncIterator]();
    let outstanding = advance();

    return {
        next: async () => {
            const result = await outstanding;
            outstanding = advance();
            return result.value;
        },
        stop: () => controller.abort(),
    };

    function advance() {
        const pending: Promise<IteratorResult<ServerUpdatedEvent>> = iterator.next();
        pending.catch(() => undefined);
        return pending;
    }
}
