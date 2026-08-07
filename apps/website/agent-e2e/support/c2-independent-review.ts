import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentFixture } from './agent-fixture.ts';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC2IndependentReviewSuite() {
    const fixture = await createAgentFixture({
        evalName: 'c2independentreview',
        profiles: [
            {
                description:
                    'Coordinates reviewed Bluebird launch announcements through distinct author and verifier lanes.',
                name: 'C2 Coordinator',
            },
            {
                description:
                    'Wait for an explicitly assigned author task before acting on ordinary Channel messages.',
                name: 'C2 Author',
            },
            {
                description:
                    'Wait for an explicitly assigned verifier task before acting on ordinary Channel messages.',
                name: 'C2 Verifier',
            },
        ],
        repositoryRoot,
    });
    try {
        const [coordinator, author, verifier] = fixture.agents;
        if (!(coordinator && author && verifier)) {
            throw new Error('C2 needs three disposable Agents.');
        }
        const channelName = `c2-${fixture.harness.stamp.slice(-8)}`;
        const channel = (await fixture.harness.trpc('chat.createChannel', {
            agentIds: [coordinator.id, author.id, verifier.id],
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
            author,
            channel: channel.id,
            channelName,
            cleanup: fixture.cleanup,
            coordinator,
            harness: fixture.harness,
            server,
            verifier,
        };
    } catch (error) {
        try {
            await fixture.cleanup();
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'C2 setup and cleanup failed.');
        }
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
        chatId: string;
        createdAt: string;
        threadChatId: string;
    };
}
