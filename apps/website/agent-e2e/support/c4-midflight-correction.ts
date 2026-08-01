import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC4MidflightCorrectionSuite() {
    const harness = await createEvalHarness({ evalName: 'c4midflightcorrection', repositoryRoot });
    const templates = await harness.requireAgents(2);
    const template = templates.find((candidate) =>
        candidate.desiredModelId.toLowerCase().includes('terra')
    );
    if (!template) {
        await harness.cleanup();
        throw new Error('C4 needs one applied Terra Agent as a configuration template.');
    }

    const temporaryAgents: AgentItem[] = [];
    const temporaryChatIds = new Set<string>();
    let channel: { id: string } | null = null;
    try {
        const coordinator = await createTemporaryAgent(harness, template, {
            description: 'Coordinates product selection without outrunning active research lanes.',
            lane: 'Coordinator',
        });
        temporaryAgents.push(coordinator);
        trackDm(temporaryChatIds, coordinator);
        const northstar = await createTemporaryAgent(harness, template, {
            description: 'Evaluates the Northstar knowledge-base candidate against owner criteria.',
            lane: 'Northstar',
        });
        temporaryAgents.push(northstar);
        trackDm(temporaryChatIds, northstar);
        const atlas = await createTemporaryAgent(harness, template, {
            description: 'Evaluates the Atlas knowledge-base candidate against owner criteria.',
            lane: 'Atlas',
        });
        temporaryAgents.push(atlas);
        trackDm(temporaryChatIds, atlas);

        const channelName = `c4-${harness.stamp.slice(-8)}`;
        channel = (await harness.trpc('chat.createChannel', {
            agentIds: [coordinator.id, northstar.id, atlas.id],
            name: channelName,
            serverId: harness.serverId,
        })) as { id: string };
        temporaryChatIds.add(channel.id);
        const servers = (await harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${harness.serverId}.`);
        }

        return {
            atlas,
            channel: channel.id,
            channelName,
            cleanup: async () => {
                await cleanupC4Resources(harness, temporaryAgents, [...temporaryChatIds]);
            },
            coordinator,
            harness,
            northstar,
            server,
        };
    } catch (error) {
        await cleanupC4Resources(harness, temporaryAgents, [...temporaryChatIds], error);
        throw error;
    }
}

export async function pollC4Tasks(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    predicate: (items: TaskItem[]) => boolean
) {
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
        const tasks = (await harness.trpc('task.list', {
            serverId: harness.serverId,
        })) as TaskItem[];
        if (predicate(tasks)) {
            return tasks;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Timed out waiting for the C4 candidate lanes.');
}

export function findC4Task(items: TaskItem[], marker: string) {
    return items.find((item) => item.message.content.trim().split('\n', 1)[0]?.startsWith(marker));
}

async function createTemporaryAgent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    template: AgentItem,
    input: { description: string; lane: string }
) {
    const displayName = `C4 ${input.lane} ${harness.stamp.slice(-6)}`;
    const created = (await harness.trpc('agent.create', {
        computerId: template.computerId,
        description: input.description,
        displayName,
        handle: `c4-${input.lane.toLowerCase()}-${harness.stamp.slice(-8).toLowerCase()}`,
        modelId: template.desiredModelId,
        role: 'member',
        runtimeId: template.desiredRuntimeId,
        serverId: harness.serverId,
    })) as { agent: AgentItem };
    return await pollAgent(harness, created.agent.id);
}

async function cleanupC4Resources(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agents: AgentItem[],
    chatIds: string[],
    originalError?: unknown
) {
    const failures: unknown[] = [];
    for (const cleanup of [
        () => deleteCreatedChats(harness, chatIds),
        () => deleteTemporaryAgents(harness, agents),
        () => withCleanupTimeout(harness.cleanup(), 'C4 harness cleanup', 15_000),
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
        `C4 resource cleanup failed: ${failures.map(formatCleanupFailure).join('; ')}`
    );
}

async function deleteCreatedChats(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    chatIds: string[]
) {
    const requestedChatIds = new Set(chatIds);
    const tasks = (await withCleanupTimeout(
        harness.trpc('task.list', { serverId: harness.serverId }),
        'list C4 task Threads for cleanup',
        10_000
    )) as TaskItem[];
    for (const task of tasks) {
        if (requestedChatIds.has(task.task.chatId)) {
            requestedChatIds.add(task.task.threadChatId);
        }
    }
    const exactChatIds = [...requestedChatIds];
    await withCleanupTimeout(
        harness.trpc('dev.cleanupEvalChats', {
            chatIds: exactChatIds,
            serverId: harness.serverId,
        }),
        `delete request for C4 chats ${exactChatIds.join(', ')}`,
        10_000
    );
}

async function deleteTemporaryAgents(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agents: AgentItem[]
) {
    const failures: Error[] = [];
    for (const agent of [...agents].reverse()) {
        try {
            await withCleanupTimeout(
                harness.trpc('agent.delete', {
                    agentId: agent.id,
                    confirmation: agent.displayName,
                    serverId: harness.serverId,
                }),
                `delete request for temporary C4 Agent ${agent.id}`,
                15_000
            );
            await pollAgentAbsent(harness, agent.id);
        } catch (error) {
            failures.push(
                new Error(`Could not delete temporary C4 Agent ${agent.id}.`, { cause: error })
            );
        }
    }
    if (failures.length > 0) {
        throw new AggregateError(failures, 'C4 Agent cleanup failed.');
    }
}

function trackDm(chatIds: Set<string>, agent: AgentItem) {
    if (agent.dmChatId) {
        chatIds.add(agent.dmChatId);
    }
}

function formatCleanupFailure(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

async function withCleanupTimeout<T>(operation: Promise<T>, label: string, timeoutMs: number) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timeout = setTimeout(
                    () => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s.`)),
                    timeoutMs
                );
            }),
        ]);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
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
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        if (!agents.some((candidate) => candidate.id === agentId)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Temporary C4 Agent ${agentId} remained after 15s.`);
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
}

interface ServerItem {
    id: string;
    slug: string;
}

export interface TaskItem {
    message: {
        content: string;
    };
    task: {
        assigneeAgentId: string | null;
        chatId: string;
        status: 'closed' | 'done' | 'in_progress' | 'in_review' | 'todo';
        threadChatId: string;
    };
}
