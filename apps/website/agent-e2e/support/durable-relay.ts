import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentFixture } from './agent-fixture.ts';

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

export async function setupDurableRelaySuite() {
    const fixture = await createAgentFixture({
        evalName: 'durablerelay',
        profiles: [
            {
                description:
                    'Authors source-backed decision briefs and durable artifacts. Acts only when explicitly addressed.',
                name: 'Relay Author',
            },
            {
                description:
                    'Continues durable work from canonical Thread history. Acts only when explicitly addressed.',
                name: 'Relay Successor',
            },
        ],
        repositoryRoot,
    });
    try {
        const [author, successor] = fixture.agents;
        if (!(author && successor)) {
            throw new Error('Durable relay needs two disposable Agents.');
        }

        const channelName = `relay-${fixture.harness.stamp.slice(-8)}`;
        const channel = (await fixture.harness.trpc('chat.createChannel', {
            agentIds: [author.id],
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
            artifactPath: `workbench/durable-relay-${fixture.harness.stamp}.html`,
            artifactTitle: `Trial decision relay ${fixture.harness.stamp}`,
            author,
            channel: channel.id,
            channelName,
            cleanup: fixture.cleanup,
            harness: fixture.harness,
            server,
            successor,
            trackChatId: fixture.trackChat,
        };
    } catch (error) {
        try {
            await fixture.cleanup();
        } catch (cleanupError) {
            throw new AggregateError(
                [error, cleanupError],
                'Durable-relay setup and cleanup failed.'
            );
        }
        throw error;
    }
}

export async function resolveThreadChatId(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    parentChatId: string,
    anchorContent: string
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const page = (await harness.trpc('chat.messages', {
            chatId: parentChatId,
            serverId: harness.serverId,
        })) as ChatPage;
        const anchor = page.messages.find((message) => message.content === anchorContent);
        const thread = page.threads.find((candidate) => candidate.anchorMessageId === anchor?.id);
        if (thread) {
            return thread.threadChatId;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out resolving the Thread for "${anchorContent}".`);
}

interface ChatPage {
    messages: Array<{ content: string; id: string }>;
    threads: Array<{ anchorMessageId: string; threadChatId: string }>;
}

interface ServerItem {
    id: string;
    slug: string;
}
