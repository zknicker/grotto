import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { openChat, openMessageThread, sendFromComposer } from '../support/live-agent-app.ts';

/**
 * User story: a human can ask an Agent to check something later without keeping a turn
 * open. When the reminder fires, the Agent rereads the source Thread and reports the
 * newest business state there exactly once.
 */
test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    if (suite?.reminder?.status === 'scheduled') {
        await suite.harness
            .trpc('reminder.cancel', {
                commandId: `agent-e2e-cleanup-${suite.harness.stamp}`,
                expectedVersion: suite.reminder.version,
                reminderId: suite.reminder.id,
                serverId: suite.harness.serverId,
            })
            .catch(() => undefined);
    }
    await suite?.harness.cleanup();
});

test('an Agent schedules and performs a one-shot business follow-up in its source Thread', async ({
    page,
}) => {
    const { agent, channel, channelName, harness, server } = suite;
    const anchor = `Bluebird deployment board ${harness.stamp}. Current status: PENDING.`;
    const freshStatus = `Bluebird deployment status: READY-${harness.stamp}`;
    const prompt = `@${agent.handle} In one minute, revisit this Thread and report its most recent Bluebird deployment status line verbatim. Schedule the follow-up; do not keep this turn alive while waiting.`;

    await openChat(page, server.slug, channel, channelName);
    await sendFromComposer(page, anchor);
    await openMessageThread(page.getByText(anchor, { exact: true }));

    const panel = page.getByRole('complementary', { name: 'Thread' });
    await panel.getByRole('textbox', { name: /Message Thread/u }).fill(prompt);
    await panel.getByRole('button', { name: 'Send' }).click();
    await expect(panel.getByText(prompt, { exact: true })).toBeVisible();

    const threadChatId = await pollThreadChatId(harness, channel, anchor);
    const scheduled = await pollScheduledReminder(harness, agent.id, threadChatId);
    suite.reminder = scheduled;
    expect(scheduled.repeat).toBeNull();
    expect(scheduled.anchorChatId).toBe(threadChatId);

    const scheduledMessages = await harness.pollMessages(
        threadChatId,
        (items) => items.some(isReminderScheduleReceipt),
        60_000
    );
    const scheduleReceipt = scheduledMessages.find(isReminderScheduleReceipt);

    await panel.getByRole('textbox', { name: /Message Thread/u }).fill(freshStatus);
    await panel.getByRole('button', { name: 'Send' }).click();
    await expect(panel.getByText(freshStatus, { exact: true })).toBeVisible();

    const messages = await harness.pollMessages(
        threadChatId,
        (items) =>
            items.some(isReminderFireReceipt) &&
            harness.authoredBy(items, agent.id).some((content) => content.includes(freshStatus)),
        240_000
    );
    const receipts = messages.filter(isReminderFireReceipt);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.content).toMatch(/^🔔 Reminder:/u);
    const result = harness
        .authoredBy(messages, agent.id)
        .find((content) => content.includes(freshStatus));
    expect(result).toBeDefined();

    await expect(panel.getByText(scheduleReceipt?.content ?? '', { exact: true })).toBeVisible();
    await expect(panel.getByText(receipts[0]?.content ?? '', { exact: true })).toBeVisible();
    await expect(panel.getByText(result ?? '', { exact: true }).first()).toBeVisible();
    suite.reminder = { ...scheduled, status: 'fired' };
});

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'agentreminderfollowup', repositoryRoot });
    const agents = (await harness.trpc('agent.list', {
        serverId: harness.serverId,
    })) as AgentItem[];
    const agent = agents.find(
        (candidate) =>
            candidate.availability !== 'offline' &&
            candidate.desiredModelId.toLowerCase().includes('terra') &&
            candidate.status === 'applied'
    );
    if (!agent) {
        await harness.cleanup();
        throw new Error('Agent E2E needs an applied online Terra Agent.');
    }

    const channelName = `reminder-${harness.stamp.slice(-8)}`;
    const channel = await harness.trpc('chat.createChannel', {
        agentIds: [agent.id],
        name: channelName,
        serverId: harness.serverId,
    });
    const servers = await harness.trpc('server.list');
    const server = servers.find((candidate: { id: string }) => candidate.id === harness.serverId);
    if (!server) {
        await harness.cleanup();
        throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
    }

    return {
        agent: { ...agent, name: agent.displayName },
        channel: channel.id as string,
        channelName,
        harness,
        reminder: null as ReminderItem | null,
        server,
    };
}

async function pollThreadChatId(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    channelId: string,
    anchor: string
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const page = (await harness.trpc('chat.messages', {
            chatId: channelId,
            serverId: harness.serverId,
        })) as ChatPage;
        const anchorMessage = page.messages.find((message) => message.content === anchor);
        const thread = page.threads.find(
            (candidate) => candidate.anchorMessageId === anchorMessage?.id
        );
        if (thread) {
            return thread.threadChatId;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for the reminder source Thread.');
}

async function pollScheduledReminder(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agentId: string,
    threadChatId: string
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const reminders = (await harness.trpc('reminder.list', {
            agentId,
            serverId: harness.serverId,
            status: 'scheduled',
        })) as ReminderItem[];
        const reminder = reminders.find((candidate) => candidate.anchorChatId === threadChatId);
        if (reminder) {
            return reminder;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for the Agent to schedule its follow-up.');
}

interface AgentItem {
    availability: 'error' | 'idle' | 'offline' | 'stopped' | 'working';
    desiredModelId: string;
    displayName: string;
    handle: string;
    id: string;
    status: 'applied' | 'degraded' | 'pending';
}

interface ChatPage {
    messages: Array<{ content: string; id: string }>;
    threads: Array<{ anchorMessageId: string; threadChatId: string }>;
}

interface ReminderItem {
    anchorChatId: string;
    id: string;
    repeat: string | null;
    status: 'canceled' | 'fired' | 'scheduled';
    version: number;
}

function isReminderFireReceipt(message: {
    author: { kind: string; system?: string };
    content: string;
}) {
    return (
        message.author.kind === 'system' &&
        message.author.system === 'reminder' &&
        message.content.startsWith('🔔 Reminder:')
    );
}

function isReminderScheduleReceipt(message: {
    author: { kind: string; system?: string };
    content: string;
}) {
    return (
        message.author.kind === 'system' &&
        message.author.system === 'reminder' &&
        message.content.includes('scheduled a reminder')
    );
}
