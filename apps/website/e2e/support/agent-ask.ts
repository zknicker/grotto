import { assertOpaqueId, createClient, runPsql } from './server.ts';

const askComputerId = 'cmp_hostedasks000000';
// Distinct from every other seeded Computer: `computers.credential_hash` is
// unique Server-wide, so a shared value fails whichever spec seeds it second.
const askCredentialHash = 'c'.repeat(64);

export interface SeededAsk {
    agentId: string;
    askId: string;
    chatId: string;
    messageId: string;
    threadChatId: string;
}

/**
 * Posts one open Ask the way an Agent does: a Server-minted runner credential
 * calling `POST /api/agent/asks`. The browser flow under test is the human
 * side of an Ask, so the Agent side stays a real Server call rather than a
 * hand-written row.
 */
export async function seedOpenAsk(input: {
    addresseeHandle: string;
    agentHandle: string;
    channelName: string;
    content: string;
    databaseUrl: string;
    recommendedStep: string;
    serverId: string;
    slug: string;
    summary: string;
    title: string;
    token: string;
}): Promise<SeededAsk> {
    const owner = createClient(input.token);
    const server = await owner.server.bySlug.query({ slug: input.slug });
    const chatId = server.channels.find((channel) => channel.name === input.channelName)?.id;
    assertOpaqueId(chatId);
    const ownerUserId = runPsql(
        input.databaseUrl,
        "select id from users where clerk_user_id = 'user_e2e_human'"
    );
    assertOpaqueId(ownerUserId);

    const inventory = {
        runtimes: [{ id: 'codex', label: 'Codex', models: [{ id: 'gpt-5.6-sol', label: 'Sol' }] }],
    };
    runPsql(
        input.databaseUrl,
        `insert into computers (id, server_id, attached_by_user_id, credential_hash, reported_inventory, health)
         values ('${askComputerId}', '${input.serverId}', '${ownerUserId}', '${askCredentialHash}', '${JSON.stringify(inventory)}'::jsonb, 'healthy')
         on conflict (id) do nothing`
    );
    const created = await owner.agent.create.mutate({
        computerId: askComputerId,
        displayName: 'Orbit',
        handle: input.agentHandle,
        modelId: 'gpt-5.6-sol',
        role: 'member',
        runtimeId: 'codex',
        serverId: input.serverId,
    });
    runPsql(
        input.databaseUrl,
        `insert into channel_agent_participants (server_id, chat_id, agent_id)
         values ('${input.serverId}', '${chatId}', '${created.agent.id}')
         on conflict do nothing`
    );

    const runnerToken = await mintAgentRunner(created.agent.id, chatId);
    const response = await fetch(`${grottoOrigin()}/api/agent/asks`, {
        body: JSON.stringify({
            addresseeHandle: input.addresseeHandle,
            content: input.content,
            nonce: `ask-${created.agent.id}`,
            recommendedStep: input.recommendedStep,
            summary: input.summary,
            target: `#${input.channelName}`,
            title: input.title,
        }),
        headers: { authorization: `Bearer ${runnerToken}`, 'content-type': 'application/json' },
        method: 'POST',
    });
    const receipt = (await response.json()) as {
        ask?: { id: string };
        messageId?: string;
    };
    if (response.status !== 200 || !(receipt.ask && receipt.messageId)) {
        throw new Error(
            `The hosted Ask fixture could not post its Ask: ${response.status} ${JSON.stringify(receipt)}`
        );
    }
    const threadChatId = runPsql(
        input.databaseUrl,
        `select id from chats where server_id = '${input.serverId}'
           and anchor_message_id = '${receipt.messageId}'`
    );
    assertOpaqueId(threadChatId);

    return {
        agentId: created.agent.id,
        askId: receipt.ask.id,
        chatId,
        messageId: receipt.messageId,
        threadChatId,
    };
}

async function mintAgentRunner(agentId: string, chatId: string) {
    const response = await fetch(`${grottoOrigin()}/computer/runner/mint`, {
        body: JSON.stringify({
            agentId,
            chatId,
            credentialHash: askCredentialHash,
            runId: 'run_e2e_ask',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(`The hosted Ask fixture could not mint a runner: ${response.status}`);
    }
    return ((await response.json()) as { runnerToken: string }).runnerToken;
}

function grottoOrigin() {
    return `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}`;
}
