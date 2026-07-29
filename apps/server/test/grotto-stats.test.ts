import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let member: GrottoClient;
let serverId: string;

const computerId = 'cmp_1234567890123456';
const usage = {
    capturedAt: '2026-07-28T20:00:00.000Z',
    codex: {
        provider: 'codex',
        snapshot: {
            capturedAt: '2026-07-28T20:00:00.000Z',
            creditsBalance: null,
            planType: 'pro',
            provider: 'codex',
            source: 'chatgpt-wham-usage',
            windows: [],
        },
        status: 'ok',
    },
    connectedProviders: ['openai-codex'],
    openRouter: {
        error: null,
        overview: {
            days: 30,
            keys: [],
            message: 'Not configured',
            note: null,
            series: [],
            status: 'unconfigured',
            totalByokUsageUsd: 0,
            totalRequests: 0,
            totalUsageUsd: 0,
        },
        status: 'ok',
    },
};

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_stats_owner', ['owner@example.com']);
    member = await signIn('user_stats_member', ['member@example.com']);
    serverId = (
        await owner.trpc.server.create.mutate({
            displayName: 'Stats HQ',
            slug: 'stats-hq',
        })
    ).id;
    const invitation = await owner.trpc.invitation.create.mutate({
        email: 'member@example.com',
        serverId,
    });
    await member.trpc.invitation.accept.mutate({ token: invitation.token });
    const [ownerRow] = await harness.sql`
        select id from users where clerk_user_id = 'user_stats_owner'
    `;
    await harness.sql`
        insert into computers (
            id, server_id, attached_by_user_id, credential_hash, health,
            architecture, operating_system, product_version, protocol_version,
            usage_snapshot, usage_reported_at
        ) values (
            ${computerId}, ${serverId}, ${ownerRow.id}, ${'a'.repeat(64)}, 'offline',
            'arm64', 'darwin', '1.1.0', 3,
            ${usage}::jsonb, '2026-07-28T20:00:01.000Z'
        )
    `;
});

afterAll(async () => {
    owner.close();
    member.close();
    await harness.close();
});

test('Members read every durable Computer usage snapshot while Computers are offline', async () => {
    await expect(member.trpc.computer.list.query({ serverId })).rejects.toThrow(/Owner or Admin/i);

    const overview = await member.trpc.stats.live.query({ serverId });
    expect(overview.computers).toEqual([
        {
            architecture: 'arm64',
            computerId,
            health: 'offline',
            operatingSystem: 'darwin',
            productVersion: '1.1.0',
            reportedAt: '2026-07-28T20:00:01.000Z',
            usage,
        },
    ]);
});

test('Stats remain readable after the Server restarts', async () => {
    await harness.sql`update computers set health = 'healthy' where id = ${computerId}`;
    member.close();
    await harness.restart();
    member = createGrottoClient(harness, await harness.clerk.mintSessionToken('user_stats_member'));

    await expect(member.trpc.stats.live.query({ serverId })).resolves.toMatchObject({
        computers: [{ computerId, health: 'offline', usage }],
    });
});

async function signIn(clerkUserId: string, verifiedEmails: string[]) {
    harness.clerkUsers.setVerifiedEmails(clerkUserId, verifiedEmails);
    const token = await harness.clerk.mintSessionToken(clerkUserId);
    return createGrottoClient(harness, token);
}
