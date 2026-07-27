import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let member: GrottoClient;
let serverId: string;
let ownerUserId: string;

const credentialHash = 'a'.repeat(64);
const otherCredentialHash = 'b'.repeat(64);
const foreignCredentialHash = 'c'.repeat(64);
const computerA = 'cmp_aaaaaaaaaaaaaaaa';
const computerB = 'cmp_bbbbbbbbbbbbbbbb';
const foreignComputer = 'cmp_cccccccccccccccc';

const codexRuntime = {
    id: 'codex',
    label: 'Codex',
    models: [
        { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
        { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    ],
};
const piRuntime = { id: 'pi', label: 'Pi', models: [{ id: 'pi', label: 'Pi' }] };

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_agent_owner');
    member = await signIn('user_agent_member');

    const server = await owner.trpc.server.create.mutate({
        displayName: 'Agent HQ',
        slug: 'agent-hq',
    });
    serverId = server.id;
    ownerUserId = await readUserId('user_agent_owner');
    await member.trpc.server.create.mutate({ displayName: 'Member Root', slug: 'member-root' });
    const memberUserId = await readUserId('user_agent_member');

    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values ('mem_agent_member', ${serverId}, ${memberUserId}, 'member')
    `;

    const foreign = await owner.trpc.server.create.mutate({
        displayName: 'Other',
        slug: 'other-hq',
    });

    // Computer A reports Codex; Computer B reports only Pi; a foreign Server owns its own Computer.
    await insertComputer(serverId, computerA, credentialHash, { runtimes: [codexRuntime] });
    await insertComputer(serverId, computerB, otherCredentialHash, { runtimes: [piRuntime] });
    await insertComputer(foreign.id, foreignComputer, foreignCredentialHash, {
        runtimes: [codexRuntime],
    });
});

afterAll(async () => {
    owner.close();
    member.close();
    await harness.close();
});

test('creates an Agent on a reported Computer with its DM, pending until effective', async () => {
    const created = await owner.trpc.agent.create.mutate({
        computerId: computerA,
        displayName: 'Cove',
        handle: 'cove',
        modelId: 'gpt-5.6-sol',
        role: 'member',
        runtimeId: 'codex',
        serverId,
    });

    expect(created.agent).toMatchObject({
        computerId: computerA,
        desiredModelId: 'gpt-5.6-sol',
        desiredRuntimeId: 'codex',
        handle: 'cove',
        status: 'pending',
    });
    expect(created.chat).toMatchObject({
        kind: 'dm',
        peerAgentId: created.agent.id,
        peerUserId: null,
    });

    const chats = await owner.trpc.chat.list.query({ serverId });
    expect(chats.find((chat) => chat.id === created.chat.id)?.peerAgentId).toBe(created.agent.id);

    const agents = await owner.trpc.agent.list.query({ serverId });
    expect(agents.map((agent) => agent.handle)).toEqual(['cove']);
    expect(agents[0]?.dmChatId).toBe(created.chat.id);
});

test('fails closed on a runtime or model the assigned Computer never reported', async () => {
    await expect(
        owner.trpc.agent.create.mutate({
            computerId: computerA,
            displayName: 'Ghost',
            handle: 'ghost',
            modelId: 'gpt-9-imaginary',
            role: 'member',
            runtimeId: 'codex',
            serverId,
        })
    ).rejects.toThrow(/does not report the model/i);

    // Pi lives only on Computer B, so referencing it on Computer A fails closed.
    await expect(
        owner.trpc.agent.create.mutate({
            computerId: computerA,
            displayName: 'Ghost',
            handle: 'ghost',
            modelId: 'pi',
            role: 'member',
            runtimeId: 'pi',
            serverId,
        })
    ).rejects.toThrow(/does not report the runtime/i);
});

test('fails closed when configuration references another Server’s Computer', async () => {
    await expect(
        owner.trpc.agent.create.mutate({
            computerId: foreignComputer,
            displayName: 'Ghost',
            handle: 'ghost',
            modelId: 'gpt-5.6-sol',
            role: 'member',
            runtimeId: 'codex',
            serverId,
        })
    ).rejects.toThrow(/not attached to this Server/i);
});

test('only an Owner or Admin can create an Agent', async () => {
    await expect(
        member.trpc.agent.create.mutate({
            computerId: computerA,
            displayName: 'Nope',
            handle: 'nope',
            modelId: 'gpt-5.6-sol',
            role: 'member',
            runtimeId: 'codex',
            serverId,
        })
    ).rejects.toThrow(/Owner or Admin/i);
});

test('saves desired config from last inventory while the Computer is offline, immutably assigned', async () => {
    await harness.sql`update computers set health = 'offline' where id = ${computerA}`;

    const [agent] = await owner.trpc.agent.list.query({ serverId });
    const reconfigured = await owner.trpc.agent.configure.mutate({
        agentId: agent.id,
        modelId: 'gpt-5.6-terra',
        runtimeId: 'codex',
        serverId,
    });

    expect(reconfigured).toMatchObject({
        computerId: computerA,
        desiredModelId: 'gpt-5.6-terra',
        status: 'pending',
    });

    await expect(
        owner.trpc.agent.configure.mutate({
            agentId: agent.id,
            modelId: 'gpt-5.6-unreleased',
            runtimeId: 'codex',
            serverId,
        })
    ).rejects.toThrow(/does not report the model/i);
});

test('shows pending, then applied, then degraded as effective state is reported', async () => {
    const [agent] = await owner.trpc.agent.list.query({ serverId });

    await harness.sql`
        update agents
        set effective_runtime_id = desired_runtime_id,
            effective_model_id = desired_model_id,
            effective_missing = null,
            effective_reported_at = now()
        where id = ${agent.id}
    `;
    let refreshed = await owner.trpc.agent.list.query({ serverId });
    expect(refreshed[0]?.status).toBe('applied');

    await harness.sql`
        update agents set effective_missing = ${JSON.stringify(['model:gpt-5.6-terra'])}::jsonb
        where id = ${agent.id}
    `;
    refreshed = await owner.trpc.agent.list.query({ serverId });
    expect(refreshed[0]?.status).toBe('degraded');
    expect(refreshed[0]?.missingResources).toEqual(['model:gpt-5.6-terra']);

    await harness.sql`
        update agents
        set effective_missing = null, effective_model_id = 'gpt-5.6-sol'
        where id = ${agent.id}
    `;
    refreshed = await owner.trpc.agent.list.query({ serverId });
    expect(refreshed[0]?.status).toBe('pending');
});

test('retires an Agent immediately, preserves authored history, and then permits Computer removal', async () => {
    const [agent] = await owner.trpc.agent.list.query({ serverId });
    const chat = (await owner.trpc.chat.list.query({ serverId })).find(
        (entry) => entry.peerAgentId === agent.id
    );
    if (!chat) throw new Error('Expected Agent DM.');

    await harness.sql`
        insert into chat_messages (id, server_id, chat_id, author_agent_id, content, nonce, sequence)
        values ('msg_agent_tombstone', ${serverId}, ${chat.id}, ${agent.id}, 'Keep this history.', 'tombstone', 1)
    `;

    await expect(
        owner.trpc.computer.remove.mutate({
            computerId: computerA,
            confirmation: 'REMOVE',
            serverId,
        })
    ).rejects.toThrow(/Delete every assigned Agent/i);
    await expect(
        owner.trpc.agent.delete.mutate({
            agentId: agent.id,
            confirmation: 'wrong name',
            serverId,
        })
    ).rejects.toThrow(/Type the Agent name exactly/i);

    await owner.trpc.agent.delete.mutate({
        agentId: agent.id,
        confirmation: agent.displayName,
        serverId,
    });

    expect(await owner.trpc.agent.list.query({ serverId })).toEqual([]);
    const retired = (await harness.sql`
        select computer_id, retired_at from agents where id = ${agent.id}
    `) as { computer_id: string | null; retired_at: Date | null }[];
    expect(retired[0]).toMatchObject({ computer_id: null });
    expect(retired[0]?.retired_at).toBeTruthy();
    const history = (await harness.sql`
        select author_agent_id, content from chat_messages where id = 'msg_agent_tombstone'
    `) as { author_agent_id: string; content: string }[];
    expect(history).toEqual([{ author_agent_id: agent.id, content: 'Keep this history.' }]);

    await owner.trpc.computer.remove.mutate({
        computerId: computerA,
        confirmation: 'REMOVE',
        serverId,
    });
    const gone = (await harness.sql`select id from computers where id = ${computerA}`) as {
        id: string;
    }[];
    expect(gone).toEqual([]);
});

async function insertComputer(
    computerServerId: string,
    computerId: string,
    hash: string,
    inventory: unknown
) {
    await harness.sql`
        insert into computers (id, server_id, attached_by_user_id, credential_hash, reported_inventory, health)
        values (
            ${computerId},
            ${computerServerId},
            ${ownerUserId},
            ${hash},
            ${JSON.stringify(inventory)}::jsonb,
            'healthy'
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
