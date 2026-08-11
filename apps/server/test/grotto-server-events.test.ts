import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { HostedServerUpdatedEvent } from '@tavern/api';
import { emitServerUpdated, subscribeToServerUpdates } from '../src/grotto-api/server-events.ts';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let serverId: string;
let ownerUserId: string;
let agentId: string;

const computerId = 'cmp_eeeeeeeeeeeeeeee';
const credentialHash = 'e'.repeat(64);
const codexRuntime = {
    id: 'codex',
    label: 'Codex',
    models: [
        { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
        { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    ],
};

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_events_owner');

    const server = await owner.trpc.server.create.mutate({
        displayName: 'Events HQ',
        slug: 'events-hq',
    });
    serverId = server.id;
    ownerUserId = await readUserId('user_events_owner');

    await harness.sql`
        insert into computers (id, server_id, attached_by_user_id, credential_hash, reported_inventory, health)
        values (
            ${computerId},
            ${serverId},
            ${ownerUserId},
            ${credentialHash},
            ${{ runtimes: [codexRuntime] }}::jsonb,
            'healthy'
        )
    `;

    const created = await owner.trpc.agent.create.mutate({
        computerId,
        description: 'Watches what the Server announces.',
        displayName: 'Signal',
        handle: 'signal',
        modelId: 'gpt-5.6-sol',
        role: 'member',
        runtimeId: 'codex',
        serverId,
    });
    agentId = created.agent.id;
});

afterAll(async () => {
    owner.close();
    await harness.close();
});

test('Computer reports carry a focused realtime invalidation scope', async () => {
    const updates = watchServerUpdates();

    emitServerUpdated({ scope: 'computer', serverId: 'srv_computer_scope' });

    expect(await updates.next()).toMatchObject({
        scope: 'computer',
        serverId: 'srv_computer_scope',
    });
    updates.stop();
});

test('an Agent-scoped announcement names the Agent whose record moved', async () => {
    const updates = watchServerUpdates();

    emitServerUpdated({ agentId: 'agt_named', scope: 'agent', serverId: 'srv_named' });

    expect(await updates.next()).toMatchObject({
        agentId: 'agt_named',
        scope: 'agent',
        serverId: 'srv_named',
    });
    updates.stop();
});

test('configuring an Agent announces that Agent to the rest of the Server', async () => {
    const updates = watchServerUpdates();

    await owner.trpc.agent.configure.mutate({
        agentId,
        modelId: 'gpt-5.6-terra',
        runtimeId: 'codex',
        serverId,
    });

    expect(await updates.next()).toMatchObject({ agentId, scope: 'agent', serverId });
    updates.stop();
});

test('starting and stopping an Agent announces its delivery change', async () => {
    const updates = watchServerUpdates();

    await owner.trpc.agent.stop.mutate({ agentId, serverId });
    expect(await updates.next()).toMatchObject({ agentId, scope: 'agent', serverId });

    await owner.trpc.agent.start.mutate({ agentId, serverId });
    expect(await updates.next()).toMatchObject({ agentId, scope: 'agent', serverId });
    updates.stop();
});

test('a profile edit announces the human to every Server they belong to', async () => {
    const updates = watchServerUpdates();

    await owner.trpc.member.updateProfile.mutate({
        description: 'Keeps the Server honest.',
        displayName: 'Ada Lovelace',
    });

    expect(await updates.next()).toMatchObject({
        memberId: ownerUserId,
        scope: 'server',
        serverId,
    });
    updates.stop();
});

/**
 * Buffers announcements from the moment it is created, so a test can act first
 * and then read what the Server said without racing the emitter.
 */
function watchServerUpdates() {
    const controller = new AbortController();
    const iterator = subscribeToServerUpdates(controller.signal)[Symbol.asyncIterator]();
    const advance = () => {
        const pending: Promise<IteratorResult<HostedServerUpdatedEvent>> = iterator.next();
        // Stopping rejects whatever read is still outstanding, and by then no
        // test is waiting on it.
        pending.catch(() => undefined);
        return pending;
    };
    let outstanding = advance();

    return {
        next: async () => {
            const result = await outstanding;
            outstanding = advance();
            return result.value;
        },
        stop: () => controller.abort(),
    };
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
