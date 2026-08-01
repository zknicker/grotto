import { expect, test } from '@playwright/test';
import {
    findC5Task,
    pollC5Tasks,
    setupC5ConflictingDeliverablesSuite,
    type TaskItem,
} from '../support/c5-conflicting-deliverables.ts';
import { openChat, sendFromComposer } from '../support/live-agent-app.ts';

test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

let suite: Awaited<ReturnType<typeof setupC5ConflictingDeliverablesSuite>>;

test.beforeAll(async () => {
    suite = await setupC5ConflictingDeliverablesSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('coordinator reconciles ownership and hands off an unresolved conflict honestly', async ({
    page,
}) => {
    const { alpha, beta, channel, channelName, coordinator, harness, server } = suite;
    const alphaMarker = `C5-ALPHA-${harness.stamp}`;
    const betaMarker = `C5-BETA-${harness.stamp}`;
    const prompt = [
        `@${coordinator.handle} Coordinate one Bluebird launch-date decision in #${channelName}.`,
        `Create exactly two separate top-level tasks with the same overlapping deliverable: independently evaluate the launch date and report the evidence. The first line of the Alpha task must be exactly ${alphaMarker}, assigned to @${alpha.handle}; the first line of the Beta task must be exactly ${betaMarker}, assigned to @${beta.handle}.`,
        'The sources conflict and neither source has priority: Alpha receives SOURCE_ALPHA with SHIP_DATE=October 15; Beta receives SOURCE_BETA with SHIP_DATE=November 1.',
        `In ${alphaMarker}, have only @${alpha.handle} claim the task and reply in its task Thread with C5-ALPHA REPORT, OWNER_ALPHA, SOURCE_ALPHA, and the exact claim SHIP_DATE=October 15. Do not report the Beta claim.`,
        `In ${betaMarker}, have only @${beta.handle} claim the task and reply in its task Thread with C5-BETA REPORT, OWNER_BETA, SOURCE_BETA, and the exact claim SHIP_DATE=November 1. Do not report the Alpha claim.`,
        `Wait until both workers report. Then publish exactly one parent-channel result beginning C5 FINAL. Include literal ownership lines ${alphaMarker} OWNER @${alpha.handle} and ${betaMarker} OWNER @${beta.handle}; preserve both source claims on separate evidence lines and name the conflict.`,
        'Because the sources are equally authoritative and contradictory, the result must say DECISION: UNRESOLVED CONFLICT and HUMAN DECISION REQUIRED. Do not silently choose, average, or combine the two dates. The coordinator must route the decision, not perform either worker lane.',
    ].join('\n');

    await openChat(page, server.slug, channel, channelName);
    const taskMode = page.getByRole('checkbox', { name: 'As Task' });
    if (await taskMode.isChecked()) {
        await taskMode.uncheck();
    }
    await sendFromComposer(page, prompt);

    const tasks = await pollC5Tasks(harness, (items) => {
        const alphaTask = findC5Task(items, alphaMarker);
        const betaTask = findC5Task(items, betaMarker);
        return (
            alphaTask?.task.assigneeAgentId === alpha.id &&
            betaTask?.task.assigneeAgentId === beta.id
        );
    });
    const alphaTask = requireTask(tasks, alphaMarker);
    const betaTask = requireTask(tasks, betaMarker);
    expect(alphaTask.task.assigneeAgentId).toBe(alpha.id);
    expect(betaTask.task.assigneeAgentId).toBe(beta.id);
    expect(alphaTask.task.assigneeAgentId).not.toBe(betaTask.task.assigneeAgentId);

    const [alphaMessages, betaMessages] = await Promise.all([
        harness.pollMessages(
            alphaTask.task.threadChatId,
            (messages) =>
                messages.some(
                    (message) =>
                        message.author.kind === 'agent' &&
                        message.author.agentId === alpha.id &&
                        message.content.includes('C5-ALPHA REPORT') &&
                        message.content.includes('SHIP_DATE=October 15')
                ),
            300_000
        ),
        harness.pollMessages(
            betaTask.task.threadChatId,
            (messages) =>
                messages.some(
                    (message) =>
                        message.author.kind === 'agent' &&
                        message.author.agentId === beta.id &&
                        message.content.includes('C5-BETA REPORT') &&
                        message.content.includes('SHIP_DATE=November 1')
                ),
            300_000
        ),
    ]);
    expect(alphaMessages.some((message) => message.author.agentId === beta.id)).toBe(false);
    expect(betaMessages.some((message) => message.author.agentId === alpha.id)).toBe(false);

    const parentMessages = await harness.pollMessages(
        channel,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinator.id &&
                    message.content.includes('C5 FINAL') &&
                    message.content.includes(alphaMarker) &&
                    message.content.includes(betaMarker) &&
                    message.content.includes('DECISION: UNRESOLVED CONFLICT') &&
                    message.content.includes('HUMAN DECISION REQUIRED')
            ),
        360_000
    );
    const final = parentMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === coordinator.id &&
            message.content.includes('C5 FINAL')
    );
    if (!final) {
        throw new Error('C5 coordinator did not publish the required final handoff.');
    }
    expect(final.content).toContain(alphaMarker);
    expect(final.content).toContain(betaMarker);
    expect(final.content).toContain(alpha.handle);
    expect(final.content).toContain(beta.handle);
    expect(final.content).toContain('SOURCE_ALPHA');
    expect(final.content).toContain('SHIP_DATE=October 15');
    expect(final.content).toContain('SOURCE_BETA');
    expect(final.content).toContain('SHIP_DATE=November 1');
    expect(final.content).toContain('DECISION: UNRESOLVED CONFLICT');
    expect(final.content).toContain('HUMAN DECISION REQUIRED');

    await openChat(page, server.slug, channel, channelName);
    const messages = page.getByLabel('Messages');
    await expect(messages).toContainText('C5 FINAL');
    await expect(messages).toContainText('SOURCE_ALPHA');
    await expect(messages).toContainText('SOURCE_BETA');
    await expect(messages).toContainText('UNRESOLVED CONFLICT');
    await expect(messages).toContainText('HUMAN DECISION REQUIRED');
});

function requireTask(items: TaskItem[], marker: string) {
    const task = findC5Task(items, marker);
    if (!task) {
        throw new Error(`Missing task ${marker}.`);
    }
    return task;
}
