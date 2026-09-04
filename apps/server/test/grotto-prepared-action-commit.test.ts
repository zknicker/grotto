import { afterAll, beforeAll, expect, test } from 'bun:test';
import { recordExactMessagesServed } from '../src/agent-delivery/cursors.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let member: GrottoClient;
let database: GrottoConnection;
let serverId: string;
let ownerUserId: string;
let proposerId: string;
let proposerChatId: string;
let proposerCredentialHash: string;

const computerId = `cmp_${'c'.repeat(16)}`;
const credentialHash = 'c'.repeat(64);
const png = Uint8Array.from(
    Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
    )
);

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    database = await connectGrottoDatabase(harness.databaseUrl);
    owner = await signIn('user_action_commit_owner');
    member = await signIn('user_action_commit_member');

    const server = await owner.trpc.server.create.mutate({
        displayName: 'Prepared Commit HQ',
        slug: 'prepared-commit-hq',
    });
    serverId = server.id;
    await owner.trpc.member.updateProfile.mutate({
        description: null,
        displayName: 'Ada',
        handle: 'ada',
        serverId,
    });
    ownerUserId = await readUserId('user_action_commit_owner');

    await member.trpc.server.create.mutate({
        displayName: 'Member Home',
        slug: 'prepared-commit-member',
    });
    const memberUserId = await readUserId('user_action_commit_member');
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values ('mem_action_commit_member', ${serverId}, ${memberUserId}, 'member')
    `;
    await harness.sql`
        insert into computers (
            id, server_id, attached_by_user_id, credential_hash, reported_inventory, health
        )
        values (
            ${computerId}, ${serverId}, ${ownerUserId}, ${credentialHash},
            ${{ runtimes: [{ id: 'codex', label: 'Codex', models: [{ id: 'gpt-5.6-sol', label: 'Sol' }] }] }}::jsonb,
            'healthy'
        )
    `;

    const proposer = await owner.trpc.agent.create.mutate({
        computerId,
        displayName: 'Cove',
        handle: 'cove-helper',
        modelId: 'gpt-5.6-sol',
        reasoningEffort: 'medium',
        role: 'member',
        runtimeId: 'codex',
        serverId,
    });
    proposerId = proposer.agent.id;
    proposerChatId = (await owner.trpc.chat.ensureAgentDm.mutate({ agentId: proposerId, serverId }))
        .id;
    proposerCredentialHash = credentialHash;

    await owner.trpc.chat.send.mutate({
        chatId: proposerChatId,
        content: 'Prepare a new Agent for the launch.',
        nonce: 'action-commit-brief',
        serverId,
    });
});

afterAll(async () => {
    owner.close();
    member.close();
    await database.close();
    await harness.close();
});

test('commits one prepared Agent atomically and replays the stored result', async () => {
    const action = await prepareAction('Orbit', 'action-commit-first');
    const input = commitInput(action.id, {
        displayName: 'Orbit Edited',
        handle: 'orbit-edited',
        reasoningEffort: 'high',
    });

    await expect(member.trpc.preparedAction.commit.mutate(input)).rejects.toThrow(
        /Owner or Admin/i
    );
    expect(await readActionStatus(action.id)).toBe('pending');

    await expect(
        owner.trpc.preparedAction.commit.mutate({
            ...input,
            modelId: 'missing-model',
        })
    ).rejects.toThrow(/does not report|runtime/i);
    expect(await readActionStatus(action.id)).toBe('pending');

    const committed = await owner.trpc.preparedAction.commit.mutate(input);
    expect(committed).toMatchObject({
        action: {
            executedByUserId: ownerUserId,
            result: {
                displayName: 'Orbit Edited',
                handle: 'orbit-edited',
                modelId: 'gpt-5.6-sol',
                reasoningEffort: 'high',
                role: 'member',
            },
            status: 'executed',
        },
        agent: {
            displayName: 'Orbit Edited',
            handle: 'orbit-edited',
            role: 'member',
        },
    });

    const replay = await owner.trpc.preparedAction.commit.mutate(input);
    expect(replay).toMatchObject({
        action: { id: action.id, status: 'executed' },
        agent: { id: committed.agent.id },
    });

    expect(await countAgents()).toBe(2);
    expect(await countAgentDms(committed.agent.id)).toBe(0);
    expect(await countAgentDeliveryRows(committed.agent.id)).toBe(0);
    expect(await countInboxItems(committed.agent.id)).toBe(0);
    expect(await countAgentTurns(committed.agent.id)).toBe(0);
    expect(await readCopiedAvatar(committed.agent.id)).toEqual(Array.from(png));
    expect(await countActionEvents(action.id, 'executed')).toBe(1);
    expect(await readAttention(action.id)).toMatchObject({
        agent_id: proposerId,
        chat_id: proposerChatId,
        created_agent_id: committed.agent.id,
        dedupe_key: action.id,
        source: 'action',
    });

    const runner = await mintRunner('run-action-starter-context');
    const sent = await fetch(new URL('/api/agent/messages/send', harness.url), {
        body: JSON.stringify({
            content: 'Welcome aboard. Here is the approved operating brief.',
            nonce: 'action-starter-context',
            target: 'dm:@orbit-edited',
        }),
        headers: {
            authorization: `Bearer ${runner.runnerToken}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    expect(sent.status).toBe(200);
    expect(await countAgentDms(committed.agent.id)).toBe(1);
    expect(await countAgentDeliveryRows(committed.agent.id)).toBe(1);
});

test('rolls back a conflicting handle and leaves the card pending', async () => {
    const action = await prepareAction('Second Orbit', 'action-commit-second');
    const before = await countAgents();

    await expect(
        owner.trpc.preparedAction.commit.mutate(
            commitInput(action.id, { displayName: 'Second Orbit', handle: 'orbit-edited' })
        )
    ).rejects.toThrow(/already taken/i);

    expect(await readActionStatus(action.id)).toBe('pending');
    expect(await countAgents()).toBe(before);
    expect(await readAttention(action.id)).toBeNull();
});

test('serializes concurrent double-submit into one Agent', async () => {
    const action = await prepareAction('Concurrent Orbit', 'action-commit-third');
    const input = commitInput(action.id, {
        displayName: 'Concurrent Orbit',
        handle: 'concurrent-orbit',
    });
    const before = await countAgents();

    const results = await Promise.all([
        owner.trpc.preparedAction.commit.mutate(input),
        owner.trpc.preparedAction.commit.mutate(input),
    ]);

    expect(results[0]?.agent.id).toBe(results[1]?.agent.id);
    expect(await countAgents()).toBe(before + 1);
    expect(await countActionEvents(action.id, 'executed')).toBe(1);
    expect(await readAttention(action.id)).not.toBeNull();
});

async function prepareAction(name: string, nonce: string) {
    const runner = await mintRunner(`run-${nonce}`);
    const history = await agentGet(runner.runnerToken);
    await recordExactMessagesServed(database.db, {
        agentId: proposerId,
        messages: history.map((message) => ({ chatId: message.chat_id, id: message.id })),
        runId: `run-${nonce}`,
        serverId,
    });
    const response = await fetch(new URL('/api/agent/actions/prepare', harness.url), {
        body: JSON.stringify({
            action: {
                description: `A useful ${name}.`,
                kind: 'agent:create',
                name,
            },
            avatar: {
                bytesBase64: Buffer.from(png).toString('base64'),
                mediaType: 'image/png',
            },
            nonce,
            target: 'dm:@ada',
        }),
        headers: {
            authorization: `Bearer ${runner.runnerToken}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { action: { id: string; status: string } };
    expect(body.action.status).toBe('pending');
    return body.action;
}

function commitInput(
    actionId: string,
    overrides: Partial<{
        displayName: string;
        handle: string;
        reasoningEffort: 'high' | 'low' | 'medium';
    }> = {}
) {
    return {
        actionId,
        computerId,
        description: 'Edited by the approving human.',
        displayName: overrides.displayName ?? 'Orbit Edited',
        handle: overrides.handle ?? 'orbit-edited',
        modelId: 'gpt-5.6-sol',
        reasoningEffort: overrides.reasoningEffort ?? 'medium',
        runtimeId: 'codex',
        serverId,
    };
}

async function mintRunner(runId: string) {
    const response = await fetch(new URL('/computer/runner/mint', harness.url), {
        body: JSON.stringify({
            agentId: proposerId,
            chatId: proposerChatId,
            credentialHash: proposerCredentialHash,
            runId,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(response.status).toBe(200);
    return (await response.json()) as { runnerToken: string };
}

async function agentGet(token: string) {
    const response = await fetch(new URL('/api/agent/history?target=dm%3A%40ada', harness.url), {
        headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { messages?: Array<{ chat_id: string; id: string }> };
    return body.messages ?? [];
}

async function readUserId(clerkUserId: string) {
    const rows = (await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `) as { id: string }[];
    return rows[0]?.id ?? '';
}

async function readActionStatus(actionId: string) {
    const rows = (await harness.sql`
        select status from prepared_actions where server_id = ${serverId} and id = ${actionId}
    `) as { status: string }[];
    return rows[0]?.status;
}

async function countAgents() {
    const rows = (await harness.sql`
        select count(*)::int as count from agents where server_id = ${serverId}
    `) as { count: number }[];
    return rows[0]?.count ?? 0;
}

async function countAgentDms(agentId: string) {
    const rows = (await harness.sql`
        select count(*)::int as count
        from chats
        where server_id = ${serverId} and kind = 'dm' and dm_agent_id = ${agentId}
    `) as { count: number }[];
    return rows[0]?.count ?? 0;
}

async function countAgentDeliveryRows(agentId: string) {
    const rows = (await harness.sql`
        select count(*)::int as count
        from agent_delivery
        where agent_id = ${agentId}
    `) as { count: number }[];
    return rows[0]?.count ?? 0;
}

async function countInboxItems(agentId: string) {
    const rows = (await harness.sql`
        select count(*)::int as count
        from agent_inbox
        where agent_id = ${agentId}
    `) as { count: number }[];
    return rows[0]?.count ?? 0;
}

async function countAgentTurns(agentId: string) {
    const rows = (await harness.sql`
        select count(*)::int as count
        from agent_turns
        where agent_id = ${agentId}
    `) as { count: number }[];
    return rows[0]?.count ?? 0;
}

async function readCopiedAvatar(agentId: string) {
    const rows = (await harness.sql`
        select a.bytes
        from avatars a
        inner join agents ag on ag.avatar_id = a.id
        where ag.server_id = ${serverId} and ag.id = ${agentId}
    `) as { bytes: Uint8Array }[];
    return rows[0]?.bytes ? Array.from(rows[0].bytes) : null;
}

async function countActionEvents(actionId: string, status: string) {
    const rows = (await harness.sql`
        select count(*)::int as count
        from chat_events
        where server_id = ${serverId} and action_id = ${actionId} and action_status = ${status}
    `) as { count: number }[];
    return rows[0]?.count ?? 0;
}

async function readAttention(actionId: string) {
    const rows = (await harness.sql`
        select agent_id, chat_id, created_agent_id, dedupe_key, source
        from agent_action_attentions
        where server_id = ${serverId} and action_id = ${actionId}
    `) as Record<string, string>[];
    return rows[0] ?? null;
}

async function signIn(clerkUserId: string) {
    return createGrottoClient(harness, await harness.clerk.mintSessionToken(clerkUserId));
}
