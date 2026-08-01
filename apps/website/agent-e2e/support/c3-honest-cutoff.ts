import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC3HonestCutoffSuite() {
    const harness = await createEvalHarness({ evalName: 'c3honestcutoff', repositoryRoot });
    const templates = await harness.requireAgents(2);
    const template = templates.find((candidate) =>
        candidate.desiredModelId.toLowerCase().includes('terra')
    );
    if (!template) {
        await harness.cleanup();
        throw new Error('C3 needs one applied Terra Agent as a configuration template.');
    }

    const temporaryAgents: AgentItem[] = [];
    try {
        const coordinator = await createTemporaryAgent(harness, template, {
            description: 'Coordinates Bluebird launch-readiness work.',
            lane: 'Coordinator',
        });
        temporaryAgents.push(coordinator);
        const responsive = await createTemporaryAgent(harness, template, {
            description: 'Reviews Bluebird customer readiness and onboarding risks.',
            lane: 'Research',
        });
        temporaryAgents.push(responsive);
        const unavailable = await createTemporaryAgent(harness, template, {
            description: 'Reviews Bluebird governance and decision-accountability risks.',
            lane: 'Governance',
        });
        temporaryAgents.push(unavailable);

        const channelName = `c3-${harness.stamp.slice(-8)}`;
        const channel = (await harness.trpc('chat.createChannel', {
            agentIds: [coordinator.id, responsive.id, unavailable.id],
            name: channelName,
            serverId: harness.serverId,
        })) as { id: string };
        const servers = (await harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${harness.serverId}.`);
        }

        const stopped = (await harness.trpc('agent.stop', {
            agentId: unavailable.id,
            serverId: harness.serverId,
        })) as DeliveryState;
        if (!stopped.stopped) {
            throw new Error(`C3 could not make temporary Agent ${unavailable.id} unavailable.`);
        }

        return {
            channel: channel.id,
            channelName,
            cleanup: async () => {
                try {
                    await deleteTemporaryAgents(harness, temporaryAgents);
                } finally {
                    await harness.cleanup();
                }
            },
            coordinator,
            harness,
            responsive,
            server,
            unavailable,
        };
    } catch (error) {
        try {
            await deleteTemporaryAgents(harness, temporaryAgents);
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'C3 setup and cleanup both failed.');
        } finally {
            await harness.cleanup();
        }
        throw error;
    }
}

export async function pollC3Tasks(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    predicate: (items: TaskItem[]) => boolean
) {
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
        const tasks = (await harness.trpc('task.list', {
            serverId: harness.serverId,
        })) as TaskItem[];
        if (predicate(tasks)) {
            return tasks;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Timed out waiting for the C3 task fan-out.');
}

export function findC3Task(items: TaskItem[], marker: string) {
    return items.find((item) => item.message.content.trim().split('\n', 1)[0]?.startsWith(marker));
}

async function createTemporaryAgent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    template: AgentItem,
    input: { description: string; lane: string }
) {
    const displayName = `C3 ${input.lane} ${harness.stamp.slice(-6)}`;
    const created = (await harness.trpc('agent.create', {
        computerId: template.computerId,
        description: input.description,
        displayName,
        handle: `c3-${input.lane.toLowerCase()}-${harness.stamp.slice(-8).toLowerCase()}`,
        modelId: template.desiredModelId,
        role: 'member',
        runtimeId: template.desiredRuntimeId,
        serverId: harness.serverId,
    })) as { agent: AgentItem };
    return await pollAgent(harness, created.agent.id);
}

async function deleteTemporaryAgents(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agents: AgentItem[]
) {
    let firstError: unknown;
    for (const agent of [...agents].reverse()) {
        try {
            await harness.trpc('agent.delete', {
                agentId: agent.id,
                confirmation: agent.displayName,
                serverId: harness.serverId,
            });
            await pollAgentAbsent(harness, agent.id);
        } catch (error) {
            firstError ??= error;
        }
    }
    if (firstError) {
        throw firstError;
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
}

interface DeliveryState {
    stopped: boolean;
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
        threadChatId: string;
    };
}
