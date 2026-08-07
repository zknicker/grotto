import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentFixture } from './agent-fixture.ts';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC5ConflictingDeliverablesSuite() {
    const fixture = await createAgentFixture({
        evalName: 'c5conflictingdeliverables',
        profiles: [
            {
                description:
                    'Coordinates overlapping deliverables, keeps ownership explicit, and preserves unresolved conflicts for human decisions.',
                name: 'C5 Coordinator',
            },
            {
                description:
                    'Owns the Alpha launch-date evidence lane and reports only its assigned work.',
                name: 'C5 Alpha',
            },
            {
                description:
                    'Owns the Beta launch-date evidence lane and reports only its assigned work.',
                name: 'C5 Beta',
            },
        ],
        repositoryRoot,
    });
    try {
        const [coordinator, alpha, beta] = fixture.agents;
        if (!(coordinator && alpha && beta)) {
            throw new Error('C5 needs three disposable Agents.');
        }

        const channelName = `c5-${fixture.harness.stamp.slice(-8)}`;
        const channel = (await fixture.harness.trpc('chat.createChannel', {
            agentIds: fixture.agents.map((agent) => agent.id),
            name: channelName,
            serverId: fixture.harness.serverId,
        })) as { id: string };
        fixture.trackChat(channel.id);
        const servers = (await fixture.harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === fixture.harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${fixture.harness.serverId}.`);
        }

        return {
            alpha,
            beta,
            channel: channel.id,
            channelName,
            cleanup: fixture.cleanup,
            coordinator,
            harness: fixture.harness,
            server,
        };
    } catch (error) {
        try {
            await fixture.cleanup();
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'C5 setup and cleanup failed.');
        }
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
