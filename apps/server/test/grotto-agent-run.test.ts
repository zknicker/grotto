import { afterAll, beforeAll, expect, test } from 'bun:test';
import { AgentDelivery } from '../src/agent-delivery/delivery.ts';
import { ComputerConnections } from '../src/computers/connections.ts';
import { recordAgentTurnSummary } from '../src/hosted-agents/record-agent-turn.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let connection: GrottoConnection;
let serverId: string;
let ownerUserId: string;
let agentId: string;
let dmChatId: string;

const computerId = 'cmp_rrrrrrrrrrrrrrrr';
const credentialHash = 'd'.repeat(64);
const codexRuntime = { id: 'codex', label: 'Codex', models: [{ id: 'gpt-5.6-sol', label: 'Sol' }] };

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    connection = await connectGrottoDatabase(harness.databaseUrl);
    owner = await signIn('user_run_owner');

    const server = await owner.trpc.server.create.mutate({ displayName: 'Run HQ', slug: 'run-hq' });
    serverId = server.id;
    ownerUserId = await readUserId('user_run_owner');

    await harness.sql`
        insert into computers (id, server_id, attached_by_user_id, credential_hash, reported_inventory, health)
        values (${computerId}, ${serverId}, ${ownerUserId}, ${credentialHash}, ${JSON.stringify({ runtimes: [codexRuntime] })}::jsonb, 'healthy')
    `;

    const created = await owner.trpc.agent.create.mutate({
        computerId,
        displayName: 'Cove',
        handle: 'cove',
        modelId: 'gpt-5.6-sol',
        role: 'member',
        runtimeId: 'codex',
        serverId,
    });
    agentId = created.agent.id;
    dmChatId = created.chat.id;
});

afterAll(async () => {
    owner.close();
    await connection.close();
    await harness.close();
});

test('mints a scoped runner credential and records a durable Agent-authored message', async () => {
    const minted = await mintRunner({ chatId: dmChatId, runId: 'run_send_1' });
    expect(minted.runnerToken).toMatch(/^grtr_/u);

    const sent = await agentSend(minted.runnerToken, {
        content: 'Hello from the Agent.',
        nonce: 'agent_nonce_1',
        target: 'dm:@operator',
    });
    expect(sent.status).toBe(200);
    expect(sent.body.receipt).toMatchObject({ chatId: dmChatId, idempotent: false });

    const rows = (await harness.sql`
        select author_agent_id, author_user_id, content from chat_messages
        where server_id = ${serverId} and chat_id = ${dmChatId} and nonce = 'agent_nonce_1'
    `) as { author_agent_id: string; author_user_id: string | null; content: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
        author_agent_id: agentId,
        author_user_id: null,
        content: 'Hello from the Agent.',
    });

    // A redriven send with the same nonce and content is idempotent, not a dup.
    const again = await agentSend(minted.runnerToken, {
        content: 'Hello from the Agent.',
        nonce: 'agent_nonce_1',
        target: 'dm:@operator',
    });
    expect(again.body.receipt).toMatchObject({
        idempotent: true,
        messageId: sent.body.receipt.messageId,
    });
    const dupCount = (await harness.sql`
        select count(*)::int as n from chat_messages
        where server_id = ${serverId} and chat_id = ${dmChatId} and nonce = 'agent_nonce_1'
    `) as { n: number }[];
    expect(dupCount[0]?.n).toBe(1);

    // The durable message reads back through the ordinary hosted surface with
    // an Agent author, not a human one.
    const page = await owner.trpc.chat.messages.query({ chatId: dmChatId, serverId });
    const agentMessage = page.messages.find((message) => message.nonce === 'agent_nonce_1');
    expect(agentMessage?.author).toEqual({ agentId, kind: 'agent' });
});

test('a revoked runner token can no longer speak as the Agent', async () => {
    const minted = await mintRunner({ chatId: dmChatId, runId: 'run_revoke_1' });
    const revoke = await fetch(new URL('/computer/runner/revoke', harness.url), {
        body: JSON.stringify({ credentialHash, runnerId: minted.runnerId }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(revoke.status).toBe(200);

    const blocked = await agentSend(minted.runnerToken, {
        content: 'Should not land.',
        nonce: 'agent_nonce_revoked',
        target: 'dm:@operator',
    });
    expect(blocked.status).toBe(401);
    expect(blocked.body.code).toBe('MISSING_TOKEN');
});

test('rejects a runner mint for an Agent on another Computer', async () => {
    const response = await fetch(new URL('/computer/runner/mint', harness.url), {
        body: JSON.stringify({
            agentId,
            chatId: dmChatId,
            credentialHash: 'e'.repeat(64),
            runId: 'run_wrong_computer',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(response.status).toBe(403);
});

test('durable delivery sends one typed start, serializes per Agent, and needs an online Computer', async () => {
    const frames: { modelId?: string; runId?: string; runtimeId?: string; type: string }[] = [];
    const connections = new ComputerConnections();
    const delivery = new AgentDelivery(connection.db, connections);

    // Offline: the message is queued durably but nothing reaches the wire.
    await delivery.deliver({
        agentId,
        chatId: dmChatId,
        content: 'first',
        dedupeKey: 'run_deliver_1',
        serverId,
    });
    expect(frames).toHaveLength(0);

    // Attaching the Computer and reconciling delivers the queued run exactly once.
    connections.register(computerId, {
        send: (frame) => frames.push(frame as (typeof frames)[number]),
        serverId,
    });
    await delivery.onComputerReconnect(computerId);
    const starts = () => frames.filter((frame) => frame.type === 'start');
    expect(starts()).toHaveLength(1);
    expect(frames[0]).toMatchObject({ modelId: 'gpt-5.6-sol', runtimeId: 'codex', type: 'start' });
    const runId = frames[0]?.runId ?? '';
    await delivery.onAck({ agentId, runId });

    // Busy: a second message queues and notices, never a second concurrent start.
    await delivery.deliver({
        agentId,
        chatId: dmChatId,
        content: 'second',
        dedupeKey: 'run_deliver_2',
        serverId,
    });
    expect(starts()).toHaveLength(1);
    expect(frames.some((frame) => frame.type === 'notice')).toBe(true);

    // The safe boundary: settling the run drains the queued work into the next.
    await delivery.onTurnSettled(computerId, {
        agentId,
        endedAt: '2026-07-27T00:00:01.000Z',
        messageCount: 0,
        runId,
        startedAt: '2026-07-27T00:00:00.000Z',
        status: 'completed',
        summary: 'ok',
        type: 'turn',
    });
    expect(starts()).toHaveLength(2);
});

test('a human DM send enqueues durable pending work atomically with the message', async () => {
    // The Agent's Computer is offline in this harness, so nothing reaches the
    // wire — but a committed human message must still leave durable pending work.
    const before = (await harness.sql`
        select count(*)::int as n from agent_pending_work
        where server_id = ${serverId} and agent_id = ${agentId}
    `) as { n: number }[];

    await owner.trpc.chat.send.mutate({
        chatId: dmChatId,
        content: 'Durable delivery, please.',
        nonce: 'human_wake_1',
        serverId,
    });

    const after = (await harness.sql`
        select content from agent_pending_work
        where server_id = ${serverId} and agent_id = ${agentId}
        order by created_at desc limit 1
    `) as { content: string }[];
    const count = (await harness.sql`
        select count(*)::int as n from agent_pending_work
        where server_id = ${serverId} and agent_id = ${agentId}
    `) as { n: number }[];
    expect(count[0]?.n).toBe((before[0]?.n ?? 0) + 1);
    expect(after[0]?.content).toBe('Durable delivery, please.');
});

test('records a compact turn summary and fails closed on cross-Computer claims', async () => {
    const summary = {
        agentId,
        endedAt: '2026-07-27T00:00:01.000Z',
        messageCount: 1,
        runId: 'run_turn_1',
        startedAt: '2026-07-27T00:00:00.000Z',
        status: 'completed' as const,
        summary: 'Sent 1 message(s).',
        type: 'turn' as const,
    };
    await recordAgentTurnSummary(connection.db, computerId, summary);
    const rows = (await harness.sql`
        select status, message_count from agent_turns
        where server_id = ${serverId} and agent_id = ${agentId} and run_id = 'run_turn_1'
    `) as { message_count: number; status: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ message_count: 1, status: 'completed' });

    // A summary from a Computer that does not own the Agent writes nothing.
    await recordAgentTurnSummary(connection.db, 'cmp_notowner00000000', {
        ...summary,
        runId: 'run_turn_foreign',
    });
    const foreign = (await harness.sql`
        select count(*)::int as n from agent_turns where run_id = 'run_turn_foreign'
    `) as { n: number }[];
    expect(foreign[0]?.n).toBe(0);
});

async function mintRunner(input: { chatId: string; runId: string }) {
    const response = await fetch(new URL('/computer/runner/mint', harness.url), {
        body: JSON.stringify({ agentId, credentialHash, ...input }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(`mint failed: ${response.status}`);
    }
    return (await response.json()) as { runnerId: string; runnerToken: string };
}

async function agentSend(token: string, body: { content: string; nonce: string; target: string }) {
    const response = await fetch(new URL('/api/agent/messages/send', harness.url), {
        body: JSON.stringify(body),
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        method: 'POST',
    });
    const payload = (await response.json()) as {
        code?: string;
        receipt?: { chatId: string; idempotent: boolean; messageId: string };
        state?: string;
    };
    return { body: payload, status: response.status };
}

async function signIn(clerkUserId: string) {
    const token = await harness.clerk.mintSessionToken(clerkUserId);
    return createGrottoClient(harness, token);
}

async function readUserId(clerkUserId: string) {
    const rows = (await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `) as { id: string }[];
    return rows[0].id;
}
