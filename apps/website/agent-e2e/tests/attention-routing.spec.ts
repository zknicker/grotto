import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentChannelFixture } from '../support/agent-channel-fixture.ts';
import {
    expectVisibleReply,
    messageByContent,
    openChat,
    openMessageThread,
    sendFromComposer,
} from '../support/live-agent-app.ts';
import {
    type AgentChatMessage,
    hasAgentMessageAfter,
    isAgentMessage,
    pollAgentTaskReply,
} from '../support/task-replies.ts';

test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

test.describe('with one disposable Agent', () => {
    let suite: Awaited<ReturnType<typeof setupAttentionSuite>>;

    test.beforeEach(async () => {
        suite = await setupAttentionSuite();
    });

    test.afterEach(async () => {
        await suite?.cleanup();
    });

    test('an addressed Thread reply stays in that exact Thread', async ({ page }) => {
        const { agent, channel, channelName, harness, server, stamp } = suite;
        const anchor = `Bluebird thread anchor ${stamp}`;
        const token = `THREAD-ROUTE-${stamp}`;

        await openChat(page, server.slug, channel, channelName);
        await sendFromComposer(page, anchor);

        await openMessageThread(messageByContent(page, anchor));

        const panel = page.getByRole('complementary', { name: 'Thread' });
        await panel
            .getByRole('textbox', { name: /Message Thread/u })
            .fill(`@${agent.handle} Reply in this Thread only with ${token}.`);
        await panel.getByRole('button', { name: 'Send' }).click();
        await expect(panel.getByText(token, { exact: true })).toBeVisible({
            timeout: 240_000,
        });

        await panel.getByRole('button', { name: 'Close thread' }).click();
        await expect(panel).toBeHidden();

        const pageSnapshot = await harness.trpc('chat.messages', {
            chatId: channel,
            serverId: harness.serverId,
        });
        const anchorMessage = pageSnapshot.messages.find(
            (message: { content: string }) => message.content === anchor
        );
        const thread = pageSnapshot.threads.find(
            (candidate: { anchorMessageId: string }) =>
                candidate.anchorMessageId === anchorMessage?.id
        );

        expect(anchorMessage).toBeDefined();
        expect(thread).toBeDefined();
        expect(
            harness
                .authoredBy(await harness.readMessages(thread.threadChatId), agent.id)
                .map((message) => message.trim())
        ).toContain(token);
    });

    test('a mute suppresses ordinary work while one mention pierces without unmuting', async ({
        page,
    }) => {
        const { agent, channel, channelName, harness, server, stamp } = suite;
        const muteToken = `MUTE-CONFIRMED-${stamp}`;
        const mentionToken = `MENTION-PIERCE-${stamp}`;

        await openChat(page, server.slug, channel, channelName);
        await sendFromComposer(
            page,
            `@${agent.handle} Mute this Channel, then reply only with ${muteToken}.`
        );
        await expectVisibleReply(page, muteToken);

        let head = await harness.readHead(channel);
        await sendFromComposer(page, `${agent.name}, reply only ORDINARY-MUTED-${stamp}.`);
        await expectNoAgentReply(harness, channel, agent.id, head);

        await sendFromComposer(page, `@${agent.handle} Reply only with ${mentionToken}.`);
        await expectVisibleReply(page, mentionToken);

        head = await harness.readHead(channel);
        await sendFromComposer(page, `${agent.name}, reply only STILL-MUTED-${stamp}.`);
        await expectNoAgentReply(harness, channel, agent.id, head);

        const unmuteToken = `UNMUTED-${stamp}`;
        await sendFromComposer(
            page,
            `@${agent.handle} Unmute this Channel, then reply only with ${unmuteToken}.`
        );
        await expectVisibleReply(page, unmuteToken);
    });
});

test.describe('with disposable Agents', () => {
    let suite: Awaited<ReturnType<typeof setupHandoffSuite>>;

    test.beforeAll(async () => {
        suite = await setupHandoffSuite();
    });

    test.afterAll(async () => {
        await suite?.cleanup();
    });

    test('one Agent can hand work to a peer in the intended Channel', async ({ page }) => {
        const { agent, channel, channelName, harness, peer, server } = suite;
        const head = await harness.readHead(channel);
        const prompt = `@${agent.handle} Ask a teammate to choose the clearer Bluebird tagline—"Quiet launch, strong signal" or "The signal starts here"—and give one sentence of reasoning. Then share the final summary here.`;

        await openChat(page, server.slug, channel, channelName);
        await sendFromComposer(page, prompt);

        const peerReply = await pollAgentTaskReply(harness, channel, peer.id);
        const channelMessages = await harness.pollMessages(
            channel,
            (rows) => hasAgentMessageAfter(rows, agent.id, head, peerReply.createdAt),
            180_000
        );
        const summary = channelMessages
            .filter(
                (message: AgentChatMessage) =>
                    isAgentMessage(message, agent.id) &&
                    message.sequence > head &&
                    message.createdAt >= peerReply.createdAt
            )
            .at(-1)
            ?.content.trim();

        expect(peerReply.content.trim()).toBeTruthy();
        expect(summary).toBeTruthy();
        await expectVisibleReply(page, summary ?? '');
    });
});

async function setupAttentionSuite() {
    const fixture = await createAgentChannelFixture({
        channelPrefix: 'attention',
        evalName: 'attentionrouting',
        profiles: [
            {
                description: 'Tests exact Thread routing and Channel attention controls.',
                name: 'Attention Router',
            },
        ],
        repositoryRoot,
    });
    const [agent] = fixture.agents;
    if (!agent) {
        await fixture.cleanup();
        throw new Error('Attention routing needs one disposable Agent.');
    }

    return {
        ...fixture,
        agent,
        stamp: fixture.harness.stamp,
    };
}

async function setupHandoffSuite() {
    const fixture = await createAgentChannelFixture({
        channelPrefix: 'attention-handoff',
        evalName: 'attentionhandoff',
        profiles: [
            {
                description: 'Coordinates a short decision with one teammate.',
                name: 'Handoff Coordinator',
            },
            {
                description: 'Reviews one option and returns concise reasoning.',
                name: 'Handoff Reviewer',
            },
        ],
        repositoryRoot,
    });

    const [agent, peer] = fixture.agents;
    if (!(agent && peer)) {
        await fixture.cleanup();
        throw new Error('Attention handoff needs two disposable Agents.');
    }
    return {
        ...fixture,
        agent,
        peer,
    };
}

async function expectNoAgentReply(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    chatId: string,
    agentId: string,
    head: number
) {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    expect(harness.authoredBy(await harness.readMessages(chatId), agentId, head)).toEqual([]);
}
