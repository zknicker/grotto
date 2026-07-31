import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { openChat, sendTaskFromComposer } from '../support/live-agent-app.ts';

test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await suite?.harness.cleanup();
});

test('a claimed task waits for Thread clarification, uses it, and moves to review', async ({
    page,
}) => {
    const { agent, channel, channelName, harness, server } = suite;
    const prompt = `@${agent.handle} Draft a two-sentence Bluebird launch blurb. Before drafting, ask me in this task Thread which audience to target; wait for my answer, then draft for that audience and move the task to review.`;

    await openChat(page, server.slug, channel, channelName);
    await sendTaskFromComposer(page, prompt);

    const task = await pollTask(harness, (item) => item.message.content === prompt);
    const anchor = page
        .getByText(prompt, { exact: true })
        .locator('xpath=ancestor::div[@data-message-id][1]');
    await anchor.hover();
    await anchor.getByRole('button', { name: 'Reply in thread' }).click();

    const panel = page.getByRole('complementary', { name: 'Thread' });
    const claimed = await pollTask(
        harness,
        (item) =>
            item.message.id === task.message.id &&
            item.task.assigneeAgentId === agent.id &&
            item.task.status === 'in_progress'
    );
    const clarificationMessages = await harness.pollMessages(
        task.task.threadChatId,
        (messages) => harness.authoredBy(messages, agent.id).length > 0,
        240_000
    );
    const firstAgentMessage = clarificationMessages.find(
        (message) => message.author.kind === 'agent' && message.author.agentId === agent.id
    );

    expect(firstAgentMessage).toBeDefined();
    expect(Date.parse(claimed.task.claimedAt ?? '')).toBeLessThanOrEqual(
        Date.parse(firstAgentMessage?.createdAt ?? '')
    );
    await expect(panel.getByText(firstAgentMessage?.content ?? '', { exact: true })).toBeVisible();

    expect((await currentTask(harness, task.message.id)).task.status).toBe('in_progress');

    const answer =
        'Target independent bookstore owners; emphasize calm setup and reliable daily use.';
    await panel.getByRole('textbox', { name: /Message Thread/u }).fill(answer);
    await panel.getByRole('button', { name: 'Send' }).click();
    await expect(panel.getByText(answer, { exact: true })).toBeVisible();

    const completedMessages = await harness.pollMessages(
        task.task.threadChatId,
        (messages) => harness.authoredBy(messages, agent.id).length > 1,
        240_000
    );
    const final = harness.authoredBy(completedMessages, agent.id).at(-1) ?? '';
    const normalized = final.toLowerCase();

    expect(normalized).toContain('bookstore');
    expect(normalized).toContain('calm');
    expect(normalized).toMatch(/reliab/u);
    await expect(panel.getByText(final, { exact: true })).toBeVisible();

    const reviewed = await pollTask(
        harness,
        (item) => item.message.id === task.message.id && item.task.status === 'in_review'
    );
    expect(reviewed.task.assigneeAgentId).toBe(agent.id);
});

test('a task message visibly projects its task state in the Chat', async ({ page }) => {
    const { channel, channelName, server, stamp } = suite;
    const prompt = `Bluebird task-state projection ${stamp}`;

    await openChat(page, server.slug, channel, channelName);
    await sendTaskFromComposer(page, prompt);

    const anchor = page
        .getByText(prompt, { exact: true })
        .locator('xpath=ancestor::div[@data-message-id][1]');
    await expect(anchor.getByTestId('message-task-badge')).toBeVisible();
});

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'tasklifecycle', repositoryRoot });
    const agents = await harness.requireAgents(2);
    const terra =
        agents.find((candidate) => candidate.desiredModelId?.includes('terra')) ?? agents[0];

    if (!terra) {
        throw new Error('Task lifecycle needs one online Agent.');
    }

    const channelName = `tasks-${harness.stamp.slice(-8)}`;
    const channel = await harness.trpc('chat.createChannel', {
        agentIds: [terra.id],
        name: channelName,
        serverId: harness.serverId,
    });
    const servers = await harness.trpc('server.list');
    const server = servers.find((candidate: { id: string }) => candidate.id === harness.serverId);

    if (!server) {
        throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
    }

    return {
        agent: terra,
        channel: channel.id,
        channelName,
        harness,
        server,
        stamp: harness.stamp,
    };
}

async function pollTask(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    predicate: (item: TaskItem) => boolean
) {
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
        const tasks = (await harness.trpc('task.list', {
            serverId: harness.serverId,
        })) as TaskItem[];
        const task = tasks.find(predicate);
        if (task) {
            return task;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Timed out waiting for the task lifecycle state.');
}

async function currentTask(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    messageId: string
) {
    return await pollTask(harness, (item) => item.message.id === messageId);
}

interface TaskItem {
    message: {
        content: string;
        id: string;
    };
    task: {
        assigneeAgentId: string | null;
        claimedAt: string | null;
        status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
        threadChatId: string;
    };
}
