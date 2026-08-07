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

    const channelHead = await harness.readHead(all);
    await openChat(page, server.slug, all, channelName);
    await sendFromComposer(
        page,
        `@${agent.handle} Without tools or files, what deployment codename did I just give you in DM? Reply only with it.`
    );

    const messages = await harness.pollMessages(
        all,
        (rows) => harness.authoredBy(rows, agent.id, channelHead).length > 0,
        240_000
    );
    const replies = harness
        .authoredBy(messages, agent.id, channelHead)
        .map((reply) => reply.trim().toLowerCase());
    expect(replies).toContain(codename.toLowerCase());
    await expectVisibleReply(page, codename);
});

test('an active Agent incorporates a message received mid-turn', async ({ page }) => {
    const { agent, all, channelName, harness, server, stamp } = suite;
    const color = `vermilion-${stamp}`;
    const prompt = `@${agent.handle} run the shell command "sleep 12". Then reply only with the release color from any message that arrived while you were working, or NO-COLOR if none arrived.`;

    await harness.waitForAgentQuiet(agent.id, 3000, 120_000);
    await openChat(page, server.slug, all, channelName);
    await sendFromComposer(page, prompt);
    await harness.waitForTurnActive(agent.id, 60_000);
    await sendFromComposer(page, `The release color for this exercise is ${color}.`);

    const task = await pollClaimedTask(harness, prompt, agent.id);
    const messages = await harness.pollMessages(
        task.task.threadChatId,
        (rows) =>
            harness
                .authoredBy(rows, agent.id)
                .some((reply) => reply.toLowerCase().includes(color.toLowerCase())),
        240_000
    );
    const reply = harness
        .authoredBy(messages, agent.id)
        .find((candidate) => candidate.toLowerCase().includes(color.toLowerCase()));

    expect(reply).toBeDefined();
    await openMessageThread(messageByContent(page, prompt));
    await expect(
        page
            .getByRole('complementary', { name: 'Thread' })
            .getByText(reply?.trim() ?? color, { exact: true })
    ).toBeVisible();
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
