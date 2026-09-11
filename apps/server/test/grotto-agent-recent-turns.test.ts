import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

/**
 * `agent.recentTurns`: the Server-wide window the Inbox strip ranks Agents by.
 * One read covers every Agent a member can see, so the page never fans a
 * per-Agent read out across the roster.
 */
let harness: GrottoServerHarness;
let owner: GrottoClient;
let outsider: GrottoClient;
let serverId: string;
let wrenId: string;
let mossId: string;

const computerId = 'cmp_recentturns00001';
const credentialHash = 'e'.repeat(64);
const runtime = { id: 'codex', label: 'Codex', models: [{ id: 'gpt-5.6-sol', label: 'Sol' }] };
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_recent_turns_owner');
    outsider = await signIn('user_recent_turns_outsider');

    const server = await owner.trpc.server.create.mutate({
        displayName: 'Recent Turns HQ',
        slug: 'recent-turns-hq',
    });
    serverId = server.id;
    await outsider.trpc.server.create.mutate({
        displayName: 'Outsider Root',
        slug: 'recent-outsider-root',
    });

    await insertComputer();
    wrenId = await createAgent('Wren', 'wren');
    mossId = await createAgent('Moss', 'moss');

    // Two Agents inside the window, one turn well outside it.
    await insertTurn(1, { agentId: wrenId, startedAgoMs: 2 * hourMs, status: 'completed' });
    await insertTurn(2, { agentId: mossId, startedAgoMs: 3 * dayMs, status: 'failed' });
    await insertTurn(3, { agentId: wrenId, startedAgoMs: 6 * dayMs, status: 'interrupted' });
    await insertTurn(4, { agentId: mossId, startedAgoMs: 20 * dayMs, status: 'completed' });
});

afterAll(async () => {
    owner.close();
    outsider.close();
    await harness.close();
});

test("reads every Agent's turns inside the window, newest first", async () => {
    const turns = await owner.trpc.agent.recentTurns.query({ serverId });

    expect(turns.map((turn) => turn.runId)).toEqual([
        'run_recentturns001',
        'run_recentturns002',
        'run_recentturns003',
    ]);
    expect(turns.map((turn) => turn.agentId)).toEqual([wrenId, mossId, wrenId]);
    expect(turns[0]).toMatchObject({ status: 'completed' });
    expect(turns[1]).toMatchObject({ status: 'failed' });
    expect(Date.parse(turns[0]?.endedAt ?? '')).toBeGreaterThan(
        Date.parse(turns[0]?.startedAt ?? '')
    );
});

test('a wider window reaches the older turn', async () => {
    const turns = await owner.trpc.agent.recentTurns.query({ days: 30, serverId });

    expect(turns).toHaveLength(4);
    expect(turns.at(-1)?.runId).toBe('run_recentturns004');
});

test('a narrower window drops everything older than it', async () => {
    const turns = await owner.trpc.agent.recentTurns.query({ days: 1, serverId });

    expect(turns.map((turn) => turn.runId)).toEqual(['run_recentturns001']);
});

test('refuses a window the contract does not allow', async () => {
    await expect(owner.trpc.agent.recentTurns.query({ days: 31, serverId })).rejects.toThrow();
    await expect(owner.trpc.agent.recentTurns.query({ days: 0, serverId })).rejects.toThrow();
});

test('refuses the read to a non-member', async () => {
    await expect(outsider.trpc.agent.recentTurns.query({ serverId })).rejects.toThrow();
});

async function createAgent(displayName: string, handle: string) {
    const created = await owner.trpc.agent.create.mutate({
        computerId,
        description: `${displayName} runs errands and reports back when something matters.`,
        displayName,
        handle,
        modelId: 'gpt-5.6-sol',
        runtimeId: 'codex',
        serverId,
    });
    return created.agent.id;
}

async function insertComputer() {
    const ownerUserId = await readUserId('user_recent_turns_owner');
    const inventory = { runtimes: [runtime] };
    await harness.sql`
        insert into computers (
            id, server_id, attached_by_user_id, credential_hash, reported_inventory, health
        )
        values (
            ${computerId},
            ${serverId},
            ${ownerUserId},
            ${credentialHash},
            ${inventory}::jsonb,
            'healthy'
        )
    `;
}

async function insertTurn(
    index: number,
    turn: {
        agentId: string;
        startedAgoMs: number;
        status: 'completed' | 'failed' | 'interrupted';
    }
) {
    const startedAt = new Date(Date.now() - turn.startedAgoMs).toISOString();
    const endedAt = new Date(Date.now() - turn.startedAgoMs + 60_000).toISOString();
    await harness.sql`
        insert into agent_turns (
            id, server_id, agent_id, computer_id, run_id, started_at, ended_at,
            status, summary, message_count, output_produced, failure_kind, activity
        )
        values (
            ${`atn_recentturns0000${index}`},
            ${serverId},
            ${turn.agentId},
            ${computerId},
            ${`run_recentturns00${index}`},
            ${startedAt}::timestamptz,
            ${endedAt}::timestamptz,
            ${turn.status},
            'settled',
            0,
            false,
            null,
            ${{ operations: [] }}::jsonb
        )
    `;
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
