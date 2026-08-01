import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { cleanupEvalChats } from './cleanup-eval-chats.ts';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC5ConflictingDeliverablesSuite() {
    const harness = await createEvalHarness({
        evalName: 'c5conflictingdeliverables',
        repositoryRoot,
    });
    const templates = await harness.requireAgents(1);
    const template =
        templates.find((candidate) => candidate.desiredModelId.toLowerCase().includes('terra')) ??
        templates[0];
    if (!template) {
        await harness.cleanup();
        throw new Error('C5 needs one applied Agent as a configuration template.');
    }

    const temporaryAgents: AgentItem[] = [];
    const temporaryChatIds = new Set<string>();
    try {
        const coordinator = await createTemporaryAgent(harness, template, {
            description:
                'Coordinates overlapping deliverables, keeps ownership explicit, and preserves unresolved conflicts for human decisions.',
            lane: 'Coordinator',
        });
        temporaryAgents.push(coordinator);
        trackDm(temporaryChatIds, coordinator);
        const alpha = await createTemporaryAgent(harness, template, {
            description:
                'Owns the Alpha launch-date evidence lane and reports only its assigned work.',
            lane: 'Alpha',
        });
        temporaryAgents.push(alpha);
        trackDm(temporaryChatIds, alpha);
        const beta = await createTemporaryAgent(harness, template, {
            description:
                'Owns the Beta launch-date evidence lane and reports only its assigned work.',
            lane: 'Beta',
        });
        temporaryAgents.push(beta);
        trackDm(temporaryChatIds, beta);

        const channelName = `c5-${harness.stamp.slice(-8)}`;
        const channel = (await harness.trpc('chat.createChannel', {
            agentIds: temporaryAgents.map((agent) => agent.id),
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
            alpha,
            beta,
            channel: channel.id,
            channelName,
            cleanup: async () => {
                await cleanupC5Resources(harness, temporaryAgents, [...temporaryChatIds]);
            },
            coordinator,
            harness,
            server,
        };
    } catch (error) {
        await cleanupC5Resources(harness, temporaryAgents, [...temporaryChatIds], error);
        throw error;
    }
}

export async function pollC5Tasks(
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
    throw new Error('Timed out waiting for the C5 conflicting-deliverables fan-out.');
}

export function findC5Task(items: TaskItem[], marker: string) {
    return items.find((item) => item.message.content.trim().split('\n', 1)[0]?.startsWith(marker));
}

async function createTemporaryAgent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    template: AgentItem,
    input: { description: string; lane: string }
) {
    const created = (await harness.trpc('agent.create', {
        computerId: template.computerId,
        description: `Temporary C5 ${input.lane.toLowerCase()} collaborator. ${input.description}`,
        displayName: `C5 ${input.lane} ${harness.stamp.slice(-6)}`,
        handle: `c5-${input.lane.toLowerCase()}-${harness.stamp.slice(-8).toLowerCase()}`,
        modelId: template.desiredModelId,
        role: 'member',
        runtimeId: template.desiredRuntimeId,
        serverId: harness.serverId,
    })) as { agent: AgentItem };
    return await pollAgent(harness, created.agent.id);
}

async function cleanupC5Resources(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agents: AgentItem[],
    chatIds: string[],
    originalError?: unknown
) {
    const failures: unknown[] = [];
    for (const cleanup of [
        () =>
            cleanupEvalChats(harness, chatIds, (operation, label) =>
                withCleanupTimeout(operation, `C5 ${label}`, 15_000)
            ),
        () => deleteTemporaryAgents(harness, agents),
        () => withCleanupTimeout(harness.cleanup(), 'C5 harness cleanup', 15_000),
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
        `C5 resource cleanup failed: ${failures.map(formatCleanupFailure).join('; ')}`
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
                `delete request for temporary C5 Agent ${agent.id}`,
                15_000
            );
            await pollAgentAbsent(harness, agent.id);
        } catch (error) {
            failures.push(
                new Error(`Could not delete temporary C5 Agent ${agent.id}.`, { cause: error })
            );
        }
    }
    if (failures.length > 0) {
        throw new AggregateError(failures, 'C5 Agent cleanup failed.');
    }
}

function trackDm(chatIds: Set<string>, agent: AgentItem) {
    if (agent.dmChatId) {
        chatIds.add(agent.dmChatId);
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
    throw new Error(`Timed out waiting for temporary C5 Agent ${agentId} to become ready.`);
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
    throw new Error(`Temporary C5 Agent ${agentId} remained after 15s.`);
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

function formatCleanupFailure(error: unknown) {
    return error instanceof Error ? error.message : String(error);
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
        createdAt: string;
    };
    task: {
        assigneeAgentId: string | null;
        chatId: string;
        threadChatId: string;
    };
}
