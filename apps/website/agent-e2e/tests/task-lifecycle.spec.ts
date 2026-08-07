import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { createAgentChannelFixture } from '../support/agent-channel-fixture.ts';
import {
    messageByContent,
    messageSurface,
    openChat,
    openMessageThread,
    sendTaskFromComposer,
} from '../support/live-agent-app.ts';

/**
 * User story: an Agent claims a promoted task, asks for missing input in its Thread,
 * waits for the fresh answer, delivers there, and only then hands the work to review.
 * This protects ownership, live Thread freshness, and visible task state as one flow.
 */
test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('a claimed task waits for Thread clarification, uses it, and moves to review', async ({
    page,
}) => {
    const { agent, channel, channelName, harness, server, stamp } = suite;
    const prompt = `@${agent.handle} Draft a two-sentence Bluebird launch blurb. Before drafting, ask me in this task Thread which audience to target; wait for my answer, then draft for that audience and move the task to review.`;

    await openChat(page, server.slug, channel, channelName);
    await sendTaskFromComposer(page, prompt);

    const task = await pollTask(harness, (item) => item.message.content === prompt);
    await openMessageThread(messageByContent(page, prompt));

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

    const audienceMarker = `BOOKSTORE-AUDIENCE-${stamp}`;
    const answer = `Target independent bookstore owners. Include the exact marker ${audienceMarker} in the final blurb. Emphasize calm setup and dependable daily use.`;
    await panel.getByRole('textbox', { name: /Message Thread/u }).fill(answer);
    await panel.getByRole('button', { name: 'Send' }).click();
    await expect(panel.getByText(answer, { exact: true })).toBeVisible();

    const completedMessages = await harness.pollMessages(
        task.task.threadChatId,
        (messages) => harness.authoredBy(messages, agent.id).length > 1,
        240_000
    );
    const final = harness.authoredBy(completedMessages, agent.id).at(-1) ?? '';

    expect(final).toContain(audienceMarker);
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

    const anchor = messageSurface(messageByContent(page, prompt));
    await expect(anchor.getByTestId('message-task-badge')).toBeVisible();
});

async function setupSuite() {
    const fixture = await createAgentChannelFixture({
        channelPrefix: 'tasks',
        evalName: 'tasklifecycle',
        profiles: [
            {
                description: 'Claims one task and completes it through its exact Thread.',
                name: 'Task Worker',
            },
        ],
        repositoryRoot,
    });
    const [agent] = fixture.agents;
    if (!agent) {
        await fixture.cleanup();
        throw new Error('Task lifecycle needs one disposable Agent.');
    }

    return {
        ...fixture,
        agent,
        stamp: fixture.harness.stamp,
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
