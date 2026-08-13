// An Agent asked to check back later must schedule a real reminder instead of
// holding its turn open, and when that reminder fires it must reread the chat
// and report the newest business state exactly once.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent asked for a one-minute follow-up schedules one non-repeating reminder anchored to the conversation, ends its turn, and after exactly one fire receipt reports the status line that arrived while it was away.',
    name: 'reminder-schedule-and-fire',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const token = marker('STATUS');
        const channel = await kit.createChannel({ agentIds: [worker.id] });
        let reminder = null;

        try {
            log('asking for the follow-up');
            await kit.harness.send(
                channel.id,
                `Deployment status board ${kit.stamp}. Current status: PENDING.`
            );
            await kit.harness.send(
                channel.id,
                `@${worker.handle} In one minute, revisit this channel and report the most recent "Deployment status:" line verbatim. Schedule the follow-up; do not keep this turn alive while waiting.`
            );

            const scheduling = await settleTurn(worker.id);
            expect(scheduling.status, 'scheduling turn status').toBe('completed');
            expect(scheduling.failureKind ?? 'none', 'scheduling turn failure kind').toBe('none');

            log('reading the scheduled reminder');
            reminder = await waitForScheduledReminder(kit, worker.id, channel.id);
            expect(reminder?.id, 'a scheduled reminder anchored to this conversation').toBeTruthy();
            expect(reminder.ownerAgentId, 'reminder owner').toBe(worker.id);
            expect(reminder.repeat ?? 'none', 'reminder repeat').toBe('none');

            const anchorChatId = reminder.anchorChatId;
            if (anchorChatId !== channel.id) {
                await kit.trackChat(anchorChatId);
            }

            const fresh = `Deployment status: READY-${token}`;
            await kit.harness.send(channel.id, fresh);
            if (anchorChatId !== channel.id) {
                await kit.harness.send(anchorChatId, fresh);
            }

            log('waiting for the reminder to fire');
            // The report lands wherever the reminder is anchored — and if that
            // anchor is the channel, the Agent may still promote the follow-up
            // to a task and report in its Thread.
            const reported = await kit.awaitAgentReply(
                anchorChatId,
                worker.id,
                (message) => message.content.includes(`READY-${token}`),
                200_000
            );
            const report = reported.message;
            expect(report.content, 'the follow-up report').toContain(`READY-${token}`);

            log('checking gates');
            const messages = await kit.readMessages(anchorChatId);
            const receipts = messages.filter(isReminderFireReceipt);
            expect(receipts, 'reminder fire receipts in the anchor chat').toHaveLength(1);
            expect(
                Date.parse(receipts[0].createdAt) <= Date.parse(report.createdAt),
                'the fire receipt precedes the follow-up report'
            ).toBe(true);
        } finally {
            await cancelIfScheduled(kit, reminder);
        }
    },
});

/** The Agent may anchor its reminder to the channel itself or to a Thread in it. */
async function waitForScheduledReminder(kit, agentId, channelId) {
    const deadline = Date.now() + 120_000;
    for (;;) {
        const page = await kit.trpc('chat.messages', {
            chatId: channelId,
            limit: 100,
            serverId: kit.serverId,
        });
        const anchors = new Set([
            channelId,
            ...(page.threads ?? []).map((thread) => thread.threadChatId),
        ]);
        const reminders = await kit.trpc('reminder.list', {
            agentId,
            serverId: kit.serverId,
            status: 'scheduled',
        });
        const scheduled = reminders.find((candidate) => anchors.has(candidate.anchorChatId));
        if (scheduled || Date.now() >= deadline) {
            return scheduled ?? null;
        }
        await wait(2000);
    }
}

async function cancelIfScheduled(kit, reminder) {
    if (!reminder) {
        return;
    }
    await kit
        .trpc('reminder.list', {
            agentId: reminder.ownerAgentId,
            serverId: kit.serverId,
            status: 'scheduled',
        })
        .then(async (rows) => {
            const current = rows.find((row) => row.id === reminder.id);
            if (!current) {
                return;
            }
            await kit.trpc('reminder.cancel', {
                commandId: `agent-tests-cleanup-${kit.stamp}`,
                expectedVersion: current.version,
                reminderId: current.id,
                serverId: kit.serverId,
            });
        })
        .catch(() => undefined);
}

function isReminderFireReceipt(message) {
    return (
        message.author.kind === 'system' &&
        message.author.system === 'reminder' &&
        message.content.startsWith('🔔 Reminder:')
    );
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
