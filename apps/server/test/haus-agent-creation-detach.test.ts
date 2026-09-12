import { expect, test } from 'bun:test';
import { agentCreationFixture } from './agent-creation-fixture.ts';

const fixture = agentCreationFixture();

test('deleting the chat that carries a creation announcement detaches the Agent', async () => {
    const runner = await fixture.mintRunner('run_create_detach');

    const created = await fixture.postCreate(
        runner,
        fixture.createBody({ displayName: 'Tether', nonce: 'create-detach' })
    );

    expect(created.status).toBe(200);
    const agentId = created.body.agent?.agentId ?? '';
    const before = await fixture.readAgentRow(agentId);
    expect(before?.creation_message_id).toBeTruthy();

    // Eval cleanup names every chat it opened, Threads included.
    const threads = (await fixture.harness.sql`
        select id from chats
        where server_id = ${fixture.serverId} and parent_chat_id = ${fixture.channelId}
    `) as { id: string }[];
    const chatIds = [fixture.channelId, ...threads.map((thread) => thread.id)];

    await expect(
        fixture.owner.trpc.dev.cleanupEvalChats.mutate({ chatIds, serverId: fixture.serverId })
    ).resolves.toMatchObject({ count: chatIds.length });

    // The Agent outlives the Message that announced it: only the link is cleared.
    const [row] = (await fixture.harness.sql`
        select creation_message_id, server_id from agents where id = ${agentId}
    `) as { creation_message_id: string | null; server_id: string }[];
    expect(row).toEqual({ creation_message_id: null, server_id: fixture.serverId });
});
