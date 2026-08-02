import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { cleanupEvalChats } from './cleanup-eval-chats.ts';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupDurableRelaySuite() {
    const harness = await createEvalHarness({ evalName: 'durablerelay', repositoryRoot });
    const template = await findTerraTemplate(harness);
    if (!template) {
        await harness.cleanup();
        throw new Error('Durable relay needs one applied online Terra Agent configuration.');
    }

    const agents: AgentItem[] = [];
    const chatIds = new Set<string>();
    try {
        const author = await createTemporaryAgent(harness, template, {
            description:
                'Authors source-backed decision briefs and durable artifacts. Acts only when explicitly addressed.',
            lane: 'Author',
        });
        agents.push(author);
        trackDm(chatIds, author);

        const successor = await createTemporaryAgent(harness, template, {
            description:
                'Continues durable work from canonical Thread history. Acts only when explicitly addressed.',
            lane: 'Successor',
        });
        agents.push(successor);
        trackDm(chatIds, successor);

        const channelName = `relay-${harness.stamp.slice(-8)}`;
        const channel = (await harness.trpc('chat.createChannel', {
            agentIds: agents.map((agent) => agent.id),
            name: channelName,
            serverId: harness.serverId,
        })) as { id: string };
        chatIds.add(channel.id);

        const servers = (await harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${harness.serverId}.`);
        }

        return {
            artifactPath: `workbench/durable-relay-${harness.stamp}.html`,
            artifactTitle: `Trial decision relay ${harness.stamp}`,
            author,
            channel: channel.id,
            channelName,
            cleanup: async () => {
                await cleanupResources(harness, agents, [...chatIds]);
            },
            harness,
            server,
            successor,
            trackChatId: (chatId: string) => chatIds.add(chatId),
        };
    } catch (error) {
        await cleanupResources(harness, agents, [...chatIds], error);
        throw error;
    }
}

export async function resolveThreadChatId(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    parentChatId: string,
    anchorContent: string
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const page = (await harness.trpc('chat.messages', {
            chatId: parentChatId,
            serverId: harness.serverId,
        })) as ChatPage;
        const anchor = page.messages.find((message) => message.content === anchorContent);
        const thread = page.threads.find((candidate) => candidate.anchorMessageId === anchor?.id);
        if (thread) {
            return thread.threadChatId;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out resolving the Thread for "${anchorContent}".`);
}

async function findTerraTemplate(
    harness: Awaited<ReturnType<typeof createEvalHarness>>
): Promise<AgentItem | null> {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        const template = agents.find(
            (candidate) =>
                candidate.status === 'applied' &&
                candidate.availability !== 'offline' &&
                candidate.availability !== 'stopped' &&
                candidate.desiredModelId.toLowerCase().includes('terra')
        );
        if (template) {
            return template;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return null;
}

async function createTemporaryAgent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    template: AgentItem,
    input: { description: string; lane: string }
) {
    const created = (await harness.trpc('agent.create', {
        computerId: template.computerId,
        description: `Temporary durable-relay ${input.lane.toLowerCase()}. ${input.description}`,
        displayName: `Relay ${input.lane} ${harness.stamp.slice(-6)}`,
        handle: `relay-${input.lane.toLowerCase()}-${harness.stamp.slice(-8).toLowerCase()}`,
        modelId: template.desiredModelId,
        role: 'member',
        runtimeId: template.desiredRuntimeId,
        serverId: harness.serverId,
    })) as { agent: AgentItem };
    return await pollAgent(harness, created.agent.id);
}

async function cleanupResources(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agents: AgentItem[],
    chatIds: string[],
    originalError?: unknown
) {
    const failures: unknown[] = [];
    for (const cleanup of [
        () => deleteTemporaryAgents(harness, agents),
        () => cleanupEvalChats(harness, chatIds),
        () => harness.cleanup(),
    ]) {
        try {
            await cleanup();
        } catch (error) {
            failures.push(error);
        }
    }
    if (failures.length === 0) {
        return;
    }
    throw new AggregateError(
        originalError === undefined ? failures : [originalError, ...failures],
        'Durable-relay resource cleanup failed.'
    );
}

async function deleteTemporaryAgents(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agents: AgentItem[]
) {
    for (const agent of agents) {
        await harness.trpc('agent.delete', {
            agentId: agent.id,
            confirmation: agent.displayName,
            serverId: harness.serverId,
        });
        await pollAgentRetired(harness, agent.id);
    }
}

async function pollAgent(harness: Awaited<ReturnType<typeof createEvalHarness>>, agentId: string) {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        const agent = agents.find((candidate) => candidate.id === agentId);
        if (
            agent?.status === 'applied' &&
            agent.availability !== 'offline' &&
            agent.availability !== 'stopped'
        ) {
            return agent;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for temporary Agent ${agentId}.`);
}

async function pollAgentRetired(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agentId: string
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        const agent = agents.find((candidate) => candidate.id === agentId);
        if (!agent || agent.status === 'retired') {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for temporary Agent ${agentId} to retire.`);
}

function trackDm(chatIds: Set<string>, agent: AgentItem) {
    if (agent.dmChatId) {
        chatIds.add(agent.dmChatId);
    }
}

interface AgentItem {
    availability: string;
    computerId: string;
    desiredModelId: string;
    desiredRuntimeId: string;
    displayName: string;
    dmChatId: string | null;
    handle: string;
    id: string;
    status: string;
}

interface ChatPage {
    messages: Array<{ content: string; id: string }>;
    threads: Array<{ anchorMessageId: string; threadChatId: string }>;
}

interface ServerItem {
    id: string;
    slug: string;
}
