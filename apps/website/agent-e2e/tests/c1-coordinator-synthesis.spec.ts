import { expect, test } from '@playwright/test';
import {
    hasC1LaneMarker,
    isC1LaneTask,
    pollC1Tasks,
    setupC1CoordinatorSuite,
} from '../support/c1-coordinator-synthesis.ts';
import { openChat, sendFromComposer } from '../support/live-agent-app.ts';

/**
 * User story: a coordinator divides independent work among named owners, waits for their
 * source-backed findings, and publishes one recommendation without redoing their lanes.
 * The test protects real delegation, evidence handoff, and synthesis.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(360_000);

let suite: Awaited<ReturnType<typeof setupC1CoordinatorSuite>>;

test.beforeAll(async () => {
    suite = await setupC1CoordinatorSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('coordinator fans out source-backed lanes and synthesizes one recommendation', async ({
    page,
}) => {
    const { channel, channelName, coordinator, harness, server } = suite;
    const pricingMarker = `C1-PRICING-${harness.stamp}`;
    const retentionMarker = `C1-RETENTION-${harness.stamp}`;
    const prompt = [
        `@${coordinator.handle} Coordinate an ordinary Bluebird launch recommendation.`,
        `Only @${coordinator.handle} is the coordinator for this request. The two collaborators must not claim, promote, or work on this ordinary prompt; they must wait for their explicitly assigned lane task.`,
        `Create exactly two independently owned task lanes in #${channelName}: one titled ${pricingMarker} and assigned to @${suite.pricing.handle}, and one titled ${retentionMarker} and assigned to @${suite.retention.handle}.`,
        'Each collaborator must claim its task before working, then put source-backed evidence in that task Thread and reply with a concise finding.',
        'Use these supplied source packets as the evidence basis and include the exact URL in each Thread reply:',
        'Pricing packet: https://www.ftc.gov/business-guidance/resources/advertising-marketing-internet-rules-road — disclose material terms clearly and avoid deceptive claims.',
        'Retention packet: https://stripe.com/resources/more/subscription-business-model — recurring revenue depends on delivering continuing customer value and reducing churn.',
        `Wait for both lane replies. Then publish exactly one final recommendation in #${channelName} with the headings Recommendation, Tradeoffs, Uncertainties, and Evidence. Include both task numbers, both lane markers, both source URLs, and clearly distinguish supplied evidence from uncertainty. Do not do either lane yourself.`,
    ].join('\n');

    if (!coordinator.dmChatId) {
        throw new Error('C1 coordinator has no seeded Owner DM.');
    }
    await openChat(page, server.slug, coordinator.dmChatId, coordinator.displayName);
    const taskMode = page.getByRole('checkbox', { name: 'As Task' });
    if (await taskMode.isChecked()) {
        await taskMode.uncheck();
    }
    await sendFromComposer(page, prompt);

    const tasks = await pollC1Tasks(harness, (items) => {
        const laneTasks = items.filter((item) =>
            isC1LaneTask(item, pricingMarker, retentionMarker)
        );
        return (
            laneTasks.length === 2 &&
            laneTasks.every((item) => item.task.assigneeAgentId !== null) &&
            new Set(laneTasks.map((item) => item.task.assigneeAgentId)).size === 2
        );
    });
    const laneTasks = [
        tasks.find((item) => hasC1LaneMarker(item, pricingMarker)),
        tasks.find((item) => hasC1LaneMarker(item, retentionMarker)),
    ];

    expect(laneTasks[0]?.task.assigneeAgentId).toBe(suite.pricing.id);
    expect(laneTasks[1]?.task.assigneeAgentId).toBe(suite.retention.id);

    for (const lane of [
        {
            agent: suite.pricing,
            marker: pricingMarker,
            task: laneTasks[0],
            url: 'https://www.ftc.gov/business-guidance/resources/advertising-marketing-internet-rules-road',
        },
        {
            agent: suite.retention,
            marker: retentionMarker,
            task: laneTasks[1],
            url: 'https://stripe.com/resources/more/subscription-business-model',
        },
    ]) {
        if (!lane.task) {
            throw new Error(`Missing task for ${lane.marker}`);
        }
        const threadMessages = await harness.pollMessages(
            lane.task.task.threadChatId,
            (messages) =>
                messages.some(
                    (message) =>
                        message.author.kind === 'agent' &&
                        message.author.agentId === lane.agent.id &&
                        message.content.includes(lane.url)
                ),
            300_000
        );
        expect(
            threadMessages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === lane.agent.id &&
                    message.content.includes(lane.url)
            )
        ).toBe(true);
    }

    const parentPage = await harness.pollMessages(
        channel,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinator.id &&
                    ['Recommendation', 'Tradeoffs', 'Uncertainties', 'Evidence'].every((heading) =>
                        message.content.includes(heading)
                    ) &&
                    message.content.includes(pricingMarker) &&
                    message.content.includes(retentionMarker) &&
                    message.content.includes('https://')
            ),
        360_000
    );
    const synthesis = parentPage.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === coordinator.id &&
            ['Recommendation', 'Tradeoffs', 'Uncertainties', 'Evidence'].every((heading) =>
                message.content.includes(heading)
            )
    );
    if (!synthesis) {
        throw new Error('Coordinator did not publish the C1 synthesis.');
    }

    await openChat(page, server.slug, channel, channelName);
    const receipt = parentPage.find(
        (message) => message.author.kind === 'system' && /new tasks? created/u.test(message.content)
    );
    expect(receipt).toBeDefined();
    if (receipt) {
        await expect(
            page.getByLabel('Messages').getByText(receipt.content, { exact: true })
        ).toBeVisible();
    }
    const messages = page.getByLabel('Messages');
    await expect(messages).toContainText('Recommendation');
    await expect(messages).toContainText('Tradeoffs');
    await expect(messages).toContainText('Uncertainties');
    await expect(messages).toContainText('Evidence');
    await expect(messages).toContainText(pricingMarker);
    await expect(messages).toContainText(retentionMarker);
});
