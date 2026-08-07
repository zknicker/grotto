import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentFixture } from './agent-fixture.ts';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC1CoordinatorSuite() {
    const fixture = await createAgentFixture({
        evalName: 'c1coordinatorsynthesis',
        profiles: [
            {
                description: 'Coordinates pricing and retention work into one final synthesis.',
                name: 'C1 Coordinator',
            },
            {
                description:
                    'Wait for an explicitly assigned pricing task before acting on ordinary Channel messages; do not coordinate or promote them.',
                name: 'C1 Pricing',
            },
            {
                description:
                    'Wait for an explicitly assigned retention task before acting on ordinary Channel messages; do not coordinate or promote them.',
                name: 'C1 Retention',
            },
        ],
        repositoryRoot,
    });
    try {
        const [coordinator, pricing, retention] = fixture.agents;
        if (!(coordinator && pricing && retention)) {
            throw new Error('C1 needs three disposable Agents.');
        }
        const channelName = `c1-${fixture.harness.stamp.slice(-8)}`;
        const channel = (await fixture.harness.trpc('chat.createChannel', {
            agentIds: [coordinator.id, pricing.id, retention.id],
            name: channelName,
            serverId: fixture.harness.serverId,
        })) as { id: string };
        fixture.trackChat(channel.id);
        const servers = (await fixture.harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === fixture.harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${fixture.harness.serverId}`);
        }

        return {
            channel: channel.id,
            channelName,
            cleanup: fixture.cleanup,
            coordinator,
            harness: fixture.harness,
            pricing,
            retention,
            server,
        };
    } catch (error) {
        try {
            await fixture.cleanup();
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'C1 setup and cleanup failed.');
        }
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
