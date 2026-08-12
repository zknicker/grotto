import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentChannelFixture } from '../support/agent-channel-fixture.ts';
import {
    expectVisibleReply,
    messageByContent,
    messageTimeline,
    openChat,
    openMessageThread,
    sendFromComposer,
} from '../support/live-agent-app.ts';
import { pollAgentReply } from '../support/task-replies.ts';

test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('one Agent carries a fact from its DM into a Channel', async ({ page }) => {
    const { agent, all, channelName, dm, harness, server, stamp } = suite;
    const codename = `Kestrel-${stamp}`;

    await openChat(page, server.slug, dm, agent.name);
    await sendFromComposer(
        page,
        `For this launch exercise, remember that the deployment codename is ${codename}. Confirm briefly.`
    );
    await expectVisibleReply(page, codename);
    await harness.waitForAgentQuiet(agent.id, 2000, 120_000);

    const channelHead = await harness.readHead(all);
    const prompt = `@${agent.handle} What deployment codename did I just give you in DM? Answer inline, no task.`;
    await openChat(page, server.slug, all, channelName);
    await sendFromComposer(page, prompt);

    const result = await pollAgentReply(
        harness,
        all,
        agent.id,
        prompt,
        (content) => content.trim().toLowerCase() === codename.toLowerCase(),
        channelHead
    );
    expect(result.threadChatId).toBeUndefined();
    await expectVisibleReply(page, codename);
});

test('an active Agent incorporates a message received mid-turn', async ({ page }) => {
    const { agent, all, channelName, harness, server, stamp } = suite;
    const color = `vermilion-${stamp}`;
    const prompt = `@${agent.handle} run the shell command "sleep 12". Then reply only with the release color from any message that arrived while you were working, or NO-COLOR if none arrived.`;

    await harness.waitForAgentQuiet(agent.id, 3000, 120_000);
    await openChat(page, server.slug, all, channelName);
    const channelHead = await harness.readHead(all);
    await sendFromComposer(page, prompt);
    await harness.waitForTurnActive(agent.id, 60_000);
    await pollClaimedTask(harness, prompt, agent.id);
    await sendFromComposer(page, `The release color for this exercise is ${color}.`);

    const terminalReply = (content: string) => {
        const normalized = content.trim().toLowerCase();
        return normalized === color.toLowerCase() || normalized === 'no-color';
    };
    const result = await pollAgentReply(harness, all, agent.id, prompt, terminalReply, channelHead);
    expect(result.reply.content.trim().toLowerCase()).toBe(color.toLowerCase());

    if (result.threadChatId) {
        await openMessageThread(messageByContent(page, prompt));
    }
    const replySurface = result.threadChatId
        ? page.getByRole('complementary', { name: 'Thread' })
        : messageTimeline(page);
    await expect(replySurface.getByText(color, { exact: true })).toBeVisible();
});

async function setupSuite() {
    const fixture = await createAgentChannelFixture({
        channelPrefix: 'continuity',
        evalName: 'agentcontinuity',
        profiles: [
            {
                description: 'Carries user context across Chats and active turns.',
                name: 'Continuity Agent',
            },
        ],
        repositoryRoot,
    });
    const [agent] = fixture.agents;
    if (!agent?.dmChatId) {
        await fixture.cleanup();
        throw new Error('Session continuity needs one disposable Agent with an Owner DM.');
    }
    return {
        ...fixture,
        agent,
        all: fixture.channel,
        dm: agent.dmChatId,
        stamp: fixture.harness.stamp,
    };
}

async function pollClaimedTask(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    content: string,
    agentId: string
) {
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
        const tasks = (await harness.trpc('task.list', {
            serverId: harness.serverId,
        })) as TaskItem[];
        const task = tasks.find(
            (item) => item.message.content === content && item.task.assigneeAgentId === agentId
        );
        if (task) {
            return task;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for the Agent to promote the active-turn message.');
}

interface TaskItem {
    message: {
        content: string;
    };
    task: {
        assigneeAgentId: string | null;
        threadChatId: string;
    };
}
