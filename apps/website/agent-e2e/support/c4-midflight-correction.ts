import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentFixture } from './agent-fixture.ts';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupC4MidflightCorrectionSuite() {
    const fixture = await createAgentFixture({
        evalName: 'c4midflightcorrection',
        profiles: [
            {
                description:
                    'Coordinates product selection without outrunning active research lanes.',
                name: 'C4 Coordinator',
            },
            {
                description:
                    'Evaluates the Northstar knowledge-base candidate against owner criteria.',
                name: 'C4 Northstar',
            },
            {
                description: 'Evaluates the Atlas knowledge-base candidate against owner criteria.',
                name: 'C4 Atlas',
            },
        ],
        repositoryRoot,
    });
    try {
        const [coordinator, northstar, atlas] = fixture.agents;
        if (!(coordinator && northstar && atlas)) {
            throw new Error('C4 needs three disposable Agents.');
        }

        const channelName = `c4-${fixture.harness.stamp.slice(-8)}`;
        const channel = (await fixture.harness.trpc('chat.createChannel', {
            agentIds: [coordinator.id, northstar.id, atlas.id],
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
            atlas,
            channel: channel.id,
            channelName,
            cleanup: fixture.cleanup,
            coordinator,
            harness: fixture.harness,
            northstar,
            server,
        };
    } catch (error) {
        try {
            await fixture.cleanup();
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'C4 setup and cleanup failed.');
        }
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
