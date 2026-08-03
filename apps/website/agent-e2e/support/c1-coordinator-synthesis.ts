import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC1CoordinatorSuite() {
    const harness = await createEvalHarness({ evalName: 'c1coordinatorsynthesis', repositoryRoot });
    const templates = await harness.requireAgents(1);
    const coordinator =
        templates.find((candidate) => candidate.desiredModelId.toLowerCase().includes('terra')) ??
        templates[0];
    if (!coordinator) {
        await harness.cleanup();
        throw new Error('C1 needs one applied coordinator Agent.');
    }

    const temporaryAgents: AgentItem[] = [];
    try {
        const pricing = await createTemporaryAgent(harness, coordinator, 'Pricing');
        temporaryAgents.push(pricing);
        const retention = await createTemporaryAgent(harness, coordinator, 'Retention');
        temporaryAgents.push(retention);
        const channelName = `c1-${harness.stamp.slice(-8)}`;
        const channel = (await harness.trpc('chat.createChannel', {
            agentIds: [coordinator.id, pricing.id, retention.id],
            name: channelName,
            serverId: harness.serverId,
        })) as { id: string };
        const servers = (await harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
        }

        return {
            channel: channel.id,
            channelName,
            cleanup: async () => {
                await deleteTemporaryAgents(harness, [pricing, retention]);
                await harness.cleanup();
            },
            coordinator,
            harness,
            pricing,
            retention,
            server,
        };
    } catch (error) {
        await deleteTemporaryAgents(harness, temporaryAgents);
        await harness.cleanup();
        throw error;
    }
}

export async function pollC1Tasks(
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
    throw new Error('Timed out waiting for the C1 task fan-out.');
}

export function hasC1LaneMarker(item: TaskItem, marker: string) {
    return item.message.content.trim().split('\n', 1)[0] === marker;
}

export function isC1LaneTask(item: TaskItem, pricingMarker: string, retentionMarker: string) {
    return hasC1LaneMarker(item, pricingMarker) || hasC1LaneMarker(item, retentionMarker);
}

async function createTemporaryAgent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    template: AgentItem,
    lane: string
) {
    const displayName = `C1 ${lane} ${harness.stamp.slice(-6)}`;
    const created = (await harness.trpc('agent.create', {
        computerId: template.computerId,
        description: `Temporary C1 ${lane.toLowerCase()} collaborator. Wait for an explicitly assigned task before acting on ordinary Channel messages; do not coordinate or promote them.`,
        displayName,
        handle: `c1-${lane.toLowerCase()}-${harness.stamp.slice(-8).toLowerCase()}`,
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
    for (const agent of agents) {
        await harness.trpc('agent.delete', {
            agentId: agent.id,
            confirmation: agent.displayName,
            serverId: harness.serverId,
        });
        await pollAgentAbsent(harness, agent.id);
    }
}

async function pollAgent(harness: Awaited<ReturnType<typeof createEvalHarness>>, agentId: string) {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        const agent = agents.find((candidate) => candidate.id === agentId);
        // A fresh Computer reports a new Agent as session-degraded until its
        // first delivered turn creates the durable session. Task delivery is the
        // event that performs that cold start, so do not gate fan-out on the
        // eventual applied snapshot here.
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
        id: string;
    };
    task: {
        assigneeAgentId: string | null;
        threadChatId: string;
    };
}
