import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import {
    expectVisibleReply,
    openChat,
    openMessageThread,
    sendFromComposer,
} from '../support/live-agent-app.ts';

test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await suite?.harness.cleanup();
});

test('an addressed Thread reply stays in that exact Thread', async ({ page }) => {
    const { agent, channel, channelName, harness, server, stamp } = suite;
    const anchor = `Bluebird thread anchor ${stamp}`;
    const token = `THREAD-ROUTE-${stamp}`;

    await openChat(page, server.slug, channel, channelName);
    await sendFromComposer(page, anchor);

    await openMessageThread(page.getByText(anchor, { exact: true }));

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
        (candidate: { anchorMessageId: string }) => candidate.anchorMessageId === anchorMessage?.id
    );

    expect(anchorMessage).toBeDefined();
    expect(thread).toBeDefined();
    expect(
        harness
            .authoredBy(await harness.readMessages(thread.threadChatId), agent.id)
            .map((message) => message.trim())
    ).toContain(token);
});

test('one Agent can hand work to a peer in the intended Channel', async ({ page }) => {
    const { agent, channel, channelName, harness, peer, server } = suite;
    const head = await harness.readHead(channel);

    await openChat(page, server.slug, channel, channelName);
    await sendFromComposer(
        page,
        `@${agent.handle} Ask your teammate ${peer.name} to choose the clearer Bluebird tagline—"Quiet launch, strong signal" or "The signal starts here"—and give one sentence of reasoning in this Channel. Then summarize the choice here.`
    );

    const messages = await harness.pollMessages(
        channel,
        (rows) => {
            const first = harness.authoredBy(rows, agent.id, head);
            const second = harness.authoredBy(rows, peer.id, head);
            return second.length > 0 && first.length > 1;
        },
        300_000
    );
    const peerReplies = harness.authoredBy(messages, peer.id, head);
    const agentReplies = harness.authoredBy(messages, agent.id, head);
    const peerReply = peerReplies.at(-1)?.trim();
    const summary = agentReplies.at(-1)?.trim();

    expect(peerReply).toBeTruthy();
    expect(summary).toBeTruthy();
    await expectVisibleReply(page, peerReply ?? '');
    await expectVisibleReply(page, summary ?? '');
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

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'attentionrouting', repositoryRoot });
    const initialAgents = await harness.requireAgents(2);
    const agent =
        initialAgents.find((candidate) => candidate.desiredModelId?.includes('terra')) ??
        initialAgents[0];
    const initialPeer = initialAgents.find((candidate) => candidate.id !== agent.id);

    if (!(initialPeer && agent.desiredRuntimeId && agent.desiredModelId)) {
        throw new Error('Attention routing needs two configurable online Agents.');
    }

    await harness.configureAgent(initialPeer, agent.desiredRuntimeId, agent.desiredModelId);
    const appliedAgents = await harness.requireAgents(2);
    const peer = appliedAgents.find((candidate) => candidate.id === initialPeer.id);
    const configuredAgent = appliedAgents.find((candidate) => candidate.id === agent.id);

    if (!(peer && configuredAgent)) {
        throw new Error('Attention routing could not resolve its configured Agents.');
    }

    const channelName = `attention-${harness.stamp.slice(-8)}`;
    const channel = await harness.trpc('chat.createChannel', {
        agentIds: [configuredAgent.id, peer.id],
        name: channelName,
        serverId: harness.serverId,
    });
    const servers = await harness.trpc('server.list');
    const server = servers.find((candidate: { id: string }) => candidate.id === harness.serverId);

    if (!server) {
        throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
    }

    return {
        agent: configuredAgent,
        channel: channel.id,
        channelName,
        harness,
        peer,
        server,
        stamp: harness.stamp,
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
