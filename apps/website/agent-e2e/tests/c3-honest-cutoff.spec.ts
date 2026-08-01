import { expect, test } from '@playwright/test';
import { findC3Task, pollC3Tasks, setupC3HonestCutoffSuite } from '../support/c3-honest-cutoff.ts';
import { openChat, sendFromComposer } from '../support/live-agent-app.ts';

test.describe.configure({ mode: 'serial' });
test.setTimeout(420_000);

let suite: Awaited<ReturnType<typeof setupC3HonestCutoffSuite>>;

test.beforeAll(async () => {
    suite = await setupC3HonestCutoffSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('coordinator ships at the cutoff and reports an unavailable input as unknown', async ({
    page,
}) => {
    const { channel, channelName, coordinator, harness, responsive, server, unavailable } = suite;
    const researchMarker = `C3-RESEARCH-${harness.stamp}`;
    const governanceMarker = `C3-GOVERNANCE-${harness.stamp}`;
    const prompt = [
        `@${coordinator.handle} Prepare a short Bluebird launch-readiness brief for the product team.`,
        `Create exactly two independently owned tasks in #${channelName}: ${researchMarker} assigned to @${responsive.handle}, and ${governanceMarker} assigned to @${unavailable.handle}.`,
        `For ${researchMarker}, ask for one customer-readiness risk based on this supplied note: beta users value fast setup, but three of eight needed help importing data.`,
        `For ${governanceMarker}, ask for one governance risk based on the collaborator's own review.`,
        'Use a firm 60-second cutoff from this request. At the cutoff, publish the useful brief in the channel even if an input is still missing; do not wait indefinitely.',
        'Use the headings Recommendation, Received input, Pending input, and Unknowns.',
        `Name both ${researchMarker} and ${governanceMarker}. Treat silence only as pending or unknown—not as approval, a negative finding, or completed work.`,
    ].join('\n');

    if (!coordinator.dmChatId) {
        throw new Error('C3 coordinator has no seeded Owner DM.');
    }
    await openChat(page, server.slug, coordinator.dmChatId, coordinator.displayName);
    const taskMode = page.getByRole('checkbox', { name: 'As Task' });
    if (await taskMode.isChecked()) {
        await taskMode.uncheck();
    }
    const sentAt = Date.now();
    await sendFromComposer(page, prompt);

    const tasks = await pollC3Tasks(harness, (items) => {
        const research = findC3Task(items, researchMarker);
        const governance = findC3Task(items, governanceMarker);
        return (
            research?.task.assigneeAgentId === responsive.id &&
            governance?.task.assigneeAgentId === unavailable.id
        );
    });
    const researchTask = findC3Task(tasks, researchMarker);
    const governanceTask = findC3Task(tasks, governanceMarker);
    expect(researchTask?.task.assigneeAgentId).toBe(responsive.id);
    expect(governanceTask?.task.assigneeAgentId).toBe(unavailable.id);
    if (!(researchTask && governanceTask)) {
        throw new Error('C3 coordinator did not create both independent tasks.');
    }

    const researchMessages = await harness.pollMessages(
        researchTask.task.threadChatId,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === responsive.id &&
                    /import|setup|onboard/iu.test(message.content)
            ),
        300_000
    );
    expect(
        researchMessages.some(
            (message) =>
                message.author.kind === 'agent' &&
                message.author.agentId === responsive.id &&
                /import|setup|onboard/iu.test(message.content)
        )
    ).toBe(true);

    const parentMessages = await harness.pollMessages(
        channel,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinator.id &&
                    ['Recommendation', 'Received input', 'Pending input', 'Unknowns'].every(
                        (heading) => message.content.includes(heading)
                    ) &&
                    message.content.includes(researchMarker) &&
                    message.content.includes(governanceMarker)
            ),
        360_000
    );
    const synthesis = parentMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === coordinator.id &&
            ['Recommendation', 'Received input', 'Pending input', 'Unknowns'].every((heading) =>
                message.content.includes(heading)
            )
    );
    if (!synthesis) {
        throw new Error('C3 coordinator did not publish an honest cutoff brief.');
    }

    const synthesisDelay = Date.parse(synthesis.createdAt) - sentAt;
    expect(synthesisDelay).toBeGreaterThanOrEqual(45_000);
    expect(synthesisDelay).toBeLessThan(180_000);
    expect(synthesis.content).toMatch(
        new RegExp(`Received input[\\s\\S]*${researchMarker}[\\s\\S]*Pending input`, 'iu')
    );
    expect(synthesis.content).toMatch(
        new RegExp(`Pending input[\\s\\S]*${governanceMarker}[\\s\\S]*Unknowns`, 'iu')
    );
    expect(synthesis.content).toMatch(new RegExp(`Unknowns[\\s\\S]*${governanceMarker}`, 'iu'));
    expect(synthesis.content).not.toMatch(
        /both (?:inputs|reviews) (?:were )?(?:received|complete)|governance (?:approved|cleared)|no governance (?:concerns|issues|risks)/iu
    );

    const governanceMessages = await harness.readMessages(governanceTask.task.threadChatId);
    expect(
        governanceMessages.some(
            (message) =>
                message.author.kind === 'agent' && message.author.agentId === unavailable.id
        )
    ).toBe(false);

    await openChat(page, server.slug, channel, channelName);
    const messages = page.getByLabel('Messages');
    await expect(messages).toContainText('Recommendation');
    await expect(messages).toContainText('Received input');
    await expect(messages).toContainText('Pending input');
    await expect(messages).toContainText('Unknowns');
    await expect(messages).toContainText(researchMarker);
    await expect(messages).toContainText(governanceMarker);
});
