import { afterAll, beforeAll, expect, test } from 'bun:test';
import { ComputerConnections } from '../src/computers/connections.ts';
import { recordAgentTurnSummary } from '../src/hosted-agents/record-agent-turn.ts';
import { createHostedMcpConnection } from '../src/hosted-mcp/service.ts';
import {
    listHostedMcpConnections,
    recordHostedMcpInventory,
    setHostedMcpGrant,
} from '../src/hosted-mcp/state.ts';
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

test('startAgentTurn sends one typed start and enforces one in-flight run', async () => {
    const frames: { modelId: string; runtimeId: string; type: string }[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        send: (frame) => frames.push(frame as (typeof frames)[number]),
        serverId,
    });

    const first = await connections.startAgentTurn(connection.db, {
        agentId,
        chatId: dmChatId,
        prompt: 'p',
    });
    expect(first.started).toBe(true);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ modelId: 'gpt-5.6-sol', runtimeId: 'codex', type: 'start' });

    const busy = await connections.startAgentTurn(connection.db, {
        agentId,
        chatId: dmChatId,
        prompt: 'p',
    });
    expect(busy).toEqual({ reason: 'busy', started: false });

    connections.finishRun(agentId);
    const resumed = await connections.startAgentTurn(connection.db, {
        agentId,
        chatId: dmChatId,
        prompt: 'p',
    });
    expect(resumed.started).toBe(true);

    const offline = new ComputerConnections();
    const offlineResult = await offline.startAgentTurn(connection.db, {
        agentId,
        chatId: dmChatId,
        prompt: 'p',
    });
    expect(offlineResult).toEqual({ reason: 'offline', started: false });
});

test('relays secrets online, persists only public state, and fails closed across Computers', async () => {
    const frames: unknown[] = [];
    const computers = new ComputerConnections();
    computers.register(computerId, { send: (frame) => frames.push(frame), serverId });
    const member = { clerkUserId: 'user_run_owner', id: ownerUserId };
    const created = await createHostedMcpConnection(connection.db, computers, member, {
        args: [],
        auth: 'headers',
        computerId,
        env: {},
        headers: { Authorization: 'Bearer attachment-secret' },
        name: 'Deterministic',
        oauthScopes: [],
        serverId,
        url: 'http://127.0.0.1:9999/mcp',
    });

    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
        connection: { headers: { Authorization: 'Bearer attachment-secret' } },
        type: 'mcp-upsert',
    });
    const rows = (await harness.sql`
        select auth, header_names, tools
        from mcp_connections where id = ${created.id}
    `) as { auth: string; header_names: string[]; tools: string[] }[];
    expect(rows[0]).toMatchObject({
        auth: 'headers',
        header_names: ['Authorization'],
        tools: [],
    });
    expect(JSON.stringify(rows)).not.toContain('attachment-secret');

    await recordHostedMcpInventory(connection.db, computerId, {
        accountLabel: 'Fixture account',
        connected: true,
        connectionId: created.id,
        tools: ['echo'],
    });
    await setHostedMcpGrant(connection.db, computers, member, {
        agentId,
        connectionId: created.id,
        enabled: true,
        serverId,
        toolName: 'echo',
    });

    const grants = (await harness.sql`
        select agent_id, connection_id, tool_name from agent_mcp_tool_grants
        where server_id = ${serverId} and agent_id = ${agentId}
    `) as { agent_id: string; connection_id: string; tool_name: string }[];
    expect(grants).toEqual([{ agent_id: agentId, connection_id: created.id, tool_name: 'echo' }]);

    const otherComputerId = 'cmp_ssssssssssssssss';
    await harness.sql`
        insert into computers (id, server_id, attached_by_user_id, credential_hash, reported_inventory, health)
        values (${otherComputerId}, ${serverId}, ${ownerUserId}, ${'e'.repeat(64)}, ${JSON.stringify({ runtimes: [codexRuntime] })}::jsonb, 'healthy')
    `;
    const otherConnectionId = 'mcp_abcdefghijklmnop';
    await harness.sql`
        insert into mcp_connections
            (id, server_id, computer_id, name, transport, auth, url, command, args,
             connected, header_names, preset, tools)
        values
            (${otherConnectionId}, ${serverId}, ${otherComputerId}, 'Other', 'stdio', 'none',
             null, 'other-mcp', ARRAY[]::text[], true, ARRAY[]::text[], null, ARRAY['echo'])
    `;
    await expect(
        setHostedMcpGrant(connection.db, computers, member, {
            agentId,
            connectionId: otherConnectionId,
            enabled: true,
            serverId,
            toolName: 'echo',
        })
    ).rejects.toThrow('same Computer');

    const offline = await listHostedMcpConnections(
        connection.db,
        new ComputerConnections(),
        member,
        serverId
    );
    expect(offline.find((item) => item.id === created.id)).toMatchObject({
        grants: [{ agentId, connectionId: created.id, toolName: 'echo' }],
        status: 'pending',
        tools: ['echo'],
    });
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
