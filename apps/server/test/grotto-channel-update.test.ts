import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let serverId: string;
let ownerUserId: string;
let firstAgentId: string;
let secondAgentId: string;

const credentialHash = 'd'.repeat(64);
const computerId = 'cmp_dddddddddddddddd';
const codexRuntime = {
    id: 'codex',
    label: 'Codex',
    models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
};

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    const token = await harness.clerk.mintSessionToken('user_channel_update');
    owner = createGrottoClient(harness, token);

    const server = await owner.trpc.server.create.mutate({
        displayName: 'Channel HQ',
        slug: 'channel-hq',
    });
    serverId = server.id;
    const rows = (await harness.sql`
        select id from users where clerk_user_id = 'user_channel_update'
    `) as { id: string }[];
    ownerUserId = rows[0].id;
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

    const first = await owner.trpc.agent.create.mutate({
        archetype: 'guide',
        computerId,
        description: 'First agent',
        displayName: 'Fen',
        handle: 'fen',
        modelId: 'gpt-5.6-sol',
        role: 'member',
        runtimeId: 'codex',
        serverId,
    });
    firstAgentId = first.agent.id;
    const second = await owner.trpc.agent.create.mutate({
        archetype: 'operator',
        computerId,
        description: 'Second agent',
        displayName: 'Juno',
        handle: 'juno',
        modelId: 'gpt-5.6-sol',
        role: 'member',
        runtimeId: 'codex',
        serverId,
    });
    secondAgentId = second.agent.id;
});

afterAll(async () => {
    owner.close();
    await harness.close();
});

test('renames a channel and replaces its Agent participants', async () => {
    const channel = await owner.trpc.chat.createChannel.mutate({
        agentIds: [firstAgentId],
        name: 'planning',
        serverId,
    });
    expect(channel.participantAgentIds).toEqual([firstAgentId]);

    const updated = await owner.trpc.chat.updateChannel.mutate({
        agentIds: [secondAgentId],
        chatId: channel.id,
        name: 'shipping',
        serverId,
    });
    expect(updated).toMatchObject({ id: channel.id, name: 'shipping' });
    expect(updated.participantAgentIds).toEqual([secondAgentId]);

    const chats = await owner.trpc.chat.list.query({ serverId });
    const reloaded = chats.find((chat) => chat.id === channel.id);
    expect(reloaded?.name).toBe('shipping');
    expect(reloaded?.participantAgentIds).toEqual([secondAgentId]);
});

test('keeping an existing Agent while adding another preserves both', async () => {
    const channel = await owner.trpc.chat.createChannel.mutate({
        agentIds: [firstAgentId],
        name: 'both-agents',
        serverId,
    });

    const updated = await owner.trpc.chat.updateChannel.mutate({
        agentIds: [firstAgentId, secondAgentId],
        chatId: channel.id,
        name: 'both-agents',
        serverId,
    });
    expect(updated.participantAgentIds).toEqual([firstAgentId, secondAgentId].sort());
});

test('rejects Agents that do not belong to the Server', async () => {
    const channel = await owner.trpc.chat.createChannel.mutate({
        agentIds: [firstAgentId],
        name: 'guarded',
        serverId,
    });

    await expect(
        owner.trpc.chat.updateChannel.mutate({
            agentIds: ['agt_0000000000000000'],
            chatId: channel.id,
            name: 'guarded',
            serverId,
        })
    ).rejects.toThrow('Choose Agents that belong to this Server.');
});

test('rejects renaming onto an existing channel name', async () => {
    const channel = await owner.trpc.chat.createChannel.mutate({
        agentIds: [firstAgentId],
        name: 'collide-a',
        serverId,
    });
    await owner.trpc.chat.createChannel.mutate({
        agentIds: [firstAgentId],
        name: 'collide-b',
        serverId,
    });

    await expect(
        owner.trpc.chat.updateChannel.mutate({
            agentIds: [firstAgentId],
            chatId: channel.id,
            name: 'collide-b',
            serverId,
        })
    ).rejects.toThrow('A channel already uses that name.');
});

test('rejects updating a DM as if it were a channel', async () => {
    const chats = await owner.trpc.chat.list.query({ serverId });
    const dm = chats.find((chat) => chat.kind === 'dm');
    expect(dm).toBeDefined();

    await expect(
        owner.trpc.chat.updateChannel.mutate({
            agentIds: [firstAgentId],
            chatId: dm?.id ?? '',
            name: 'not-a-channel',
            serverId,
        })
    ).rejects.toThrow('That channel does not exist on this Server.');
});
