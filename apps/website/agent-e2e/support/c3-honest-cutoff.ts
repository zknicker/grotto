import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentFixture } from './agent-fixture.ts';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC3HonestCutoffSuite() {
    const fixture = await createAgentFixture({
        evalName: 'c3honestcutoff',
        profiles: [
            {
                description: 'Coordinates Bluebird launch-readiness work.',
                name: 'C3 Coordinator',
            },
            {
                description: 'Reviews Bluebird customer readiness and onboarding risks.',
                name: 'C3 Research',
            },
            {
                description: 'Reviews Bluebird governance and decision-accountability risks.',
                name: 'C3 Governance',
            },
        ],
        repositoryRoot,
    });
    try {
        const [coordinator, responsive, unavailable] = fixture.agents;
        if (!(coordinator && responsive && unavailable)) {
            throw new Error('C3 needs three disposable Agents.');
        }

        const channelName = `c3-${fixture.harness.stamp.slice(-8)}`;
        const channel = (await fixture.harness.trpc('chat.createChannel', {
            agentIds: [coordinator.id, responsive.id, unavailable.id],
            name: channelName,
            serverId: fixture.harness.serverId,
        })) as { id: string };
        fixture.trackChat(channel.id);
        const servers = (await fixture.harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === fixture.harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${fixture.harness.serverId}.`);
        }

        const stopped = (await fixture.harness.trpc('agent.stop', {
            agentId: unavailable.id,
            serverId: fixture.harness.serverId,
        })) as DeliveryState;
        if (!stopped.stopped) {
            throw new Error(`C3 could not make temporary Agent ${unavailable.id} unavailable.`);
        }

        return {
            channel: channel.id,
            channelName,
            cleanup: fixture.cleanup,
            coordinator,
            harness: fixture.harness,
            responsive,
            server,
            unavailable,
        };
    } catch (error) {
        try {
            await fixture.cleanup();
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'C3 setup and cleanup failed.');
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
        chatId: string;
        threadChatId: string;
    };
}
