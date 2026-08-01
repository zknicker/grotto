import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC2IndependentReviewSuite() {
    const harness = await createEvalHarness({ evalName: 'c2independentreview', repositoryRoot });
    const templates = await harness.requireAgents(2);
    const coordinator = templates.find((candidate) =>
        candidate.desiredModelId.toLowerCase().includes('terra')
    );
    if (!coordinator) {
        await harness.cleanup();
        throw new Error('C2 needs one applied online Terra coordinator Agent.');
    }

    const temporaryAgents: AgentItem[] = [];
    let channel: { id: string } | null = null;
    try {
        const author = await createTemporaryAgent(harness, coordinator, 'Author');
        temporaryAgents.push(author);
        const verifier = await createTemporaryAgent(harness, coordinator, 'Verifier');
        temporaryAgents.push(verifier);
        const channelName = `c2-${harness.stamp.slice(-8)}`;
        channel = (await harness.trpc('chat.createChannel', {
            agentIds: [coordinator.id, author.id, verifier.id],
            name: channelName,
            serverId: harness.serverId,
        })) as { id: string };
        const servers = (await harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
        }

        return {
            author,
            channel: channel.id,
            channelName,
            cleanup: async () => {
                await cleanupC2Resources(
                    harness,
                    [author, verifier],
                    [channel?.id, author.dmChatId, verifier.dmChatId]
                );
            },
            coordinator,
            harness,
            server,
            verifier,
        };
    } catch (error) {
        await cleanupC2Resources(
            harness,
            temporaryAgents,
            [channel?.id, ...temporaryAgents.map((agent) => agent.dmChatId)],
            error
        );
        throw error;
    }
}

export async function pollC2Tasks(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    predicate: (items: TaskItem[]) => boolean
) {
    const deadline = Date.now() + 360_000;
    while (Date.now() < deadline) {
        const tasks = (await harness.trpc('task.list', {
            serverId: harness.serverId,
        })) as TaskItem[];
        if (predicate(tasks)) {
            return tasks;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Timed out waiting for the C2 review chain.');
}

export function hasC2Marker(item: TaskItem, marker: string) {
    return item.message.content.trim().split('\n', 1)[0] === marker;
}

export function extractMarkedSection(content: string, start: string, end: string) {
    const startIndex = content.indexOf(start);
    const endIndex = content.indexOf(end, startIndex + start.length);
    if (startIndex === -1 || endIndex === -1) {
        return null;
    }
    return content.slice(startIndex + start.length, endIndex).trim();
}

async function createTemporaryAgent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    template: AgentItem,
    lane: string
) {
    const displayName = `C2 ${lane} ${harness.stamp.slice(-6)}`;
    const created = (await harness.trpc('agent.create', {
        computerId: template.computerId,
        description: `Temporary C2 ${lane.toLowerCase()} collaborator. Wait for an explicitly assigned task before acting on ordinary Channel messages.`,
        displayName,
        handle: `c2-${lane.toLowerCase()}-${harness.stamp.slice(-8).toLowerCase()}`,
        modelId: template.desiredModelId,
        role: 'member',
        runtimeId: template.desiredRuntimeId,
        serverId: harness.serverId,
    })) as { agent: AgentItem };
    return await pollAgent(harness, created.agent.id);
}

async function archiveCreatedChats(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    chatIds: Array<string | null | undefined>
) {
    const failures: Error[] = [];
    for (const chatId of chatIds) {
        if (!chatId) {
            continue;
        }
        try {
            await harness.trpc('chat.archive', { chatId });
        } catch (error) {
            failures.push(new Error(`Could not archive C2 chat ${chatId}.`, { cause: error }));
        }
    }
    if (failures.length > 0) {
        throw new AggregateError(failures, 'C2 chat cleanup failed.');
    }
}

async function deleteTemporaryAgents(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agents: AgentItem[]
) {
    const failures: Error[] = [];
    for (const agent of agents) {
        try {
            await harness.trpc('agent.delete', {
                agentId: agent.id,
                confirmation: agent.displayName,
                serverId: harness.serverId,
            });
            await pollAgentAbsent(harness, agent.id);
        } catch (error) {
            failures.push(
                new Error(`Could not delete temporary C2 Agent ${agent.id}.`, { cause: error })
            );
        }
    }
    if (failures.length > 0) {
        throw new AggregateError(failures, 'C2 Agent cleanup failed.');
    }
}

async function cleanupC2Resources(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agents: AgentItem[],
    chatIds: Array<string | null | undefined>,
    originalError?: unknown
) {
    const failures: unknown[] = [];
    for (const cleanup of [
        () => archiveCreatedChats(harness, chatIds),
        () => deleteTemporaryAgents(harness, agents),
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
        'C2 resource cleanup failed.'
    );
}

async function pollAgent(harness: Awaited<ReturnType<typeof createEvalHarness>>, agentId: string) {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        const agent = agents.find((candidate) => candidate.id === agentId);
        if (agent && agent.availability !== 'offline') {
            return agent;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for temporary Agent ${agentId} to become ready.`);
}

async function pollAgentAbsent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agentId: string
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        if (!agents.some((candidate) => candidate.id === agentId)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for temporary Agent ${agentId} to disappear.`);
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

interface ServerItem {
    displayName: string;
    id: string;
    slug: string;
}

export interface TaskItem {
    message: {
        content: string;
        createdAt: string;
        id: string;
    };
    task: {
        assigneeAgentId: string | null;
        createdAt: string;
        threadChatId: string;
    };
}
