import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let outsider: GrottoClient;
let serverId: string;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = createGrottoClient(harness, await harness.clerk.mintSessionToken('preset-owner'));
    outsider = createGrottoClient(harness, await harness.clerk.mintSessionToken('preset-outsider'));
    serverId = (await owner.trpc.server.create.mutate({ displayName: 'Presets', slug: 'presets' }))
        .id;
    await outsider.trpc.server.create.mutate({ displayName: 'Other', slug: 'other-presets' });
});

afterAll(async () => {
    owner?.close();
    outsider?.close();
    await harness?.close();
});

test.each([
    'merchbase',
    'google-calendar',
] as const)('deletes a %s account and its secrets without removing another account', async (preset) => {
    const first = await owner.trpc.mcp.addPresetAccount.mutate({ name: preset, preset, serverId });
    const second = await owner.trpc.mcp.addPresetAccount.mutate({ name: preset, preset, serverId });
    expect(first.id).not.toBe(second.id);
    const input = { connectionId: first.id, serverId };

    await expect(outsider.trpc.mcp.delete.mutate(input)).rejects.toThrow();
    expect(await owner.trpc.mcp.list.query({ serverId })).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: first.id })])
    );

    await expect(owner.trpc.mcp.delete.mutate(input)).resolves.toMatchObject({ id: first.id });
    expect(
        await harness.sql`select * from mcp_secrets where connection_id = ${first.id}`
    ).toHaveLength(0);
    expect(await owner.trpc.mcp.list.query({ serverId })).toEqual([
        expect.objectContaining({ id: second.id }),
    ]);

    await harness.sql`update mcp_connections set connected = true where id = ${second.id}`;
    await expect(
        owner.trpc.mcp.delete.mutate({ connectionId: second.id, serverId })
    ).resolves.toMatchObject({ connected: true, id: second.id });
    expect(await owner.trpc.mcp.list.query({ serverId })).toEqual([]);
    expect(
        await harness.sql`select * from mcp_secrets where connection_id = ${second.id}`
    ).toHaveLength(0);
});
