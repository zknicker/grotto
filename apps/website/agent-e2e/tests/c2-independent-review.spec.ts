import { expect, test } from '@playwright/test';
import {
    extractMarkedSection,
    hasC2Marker,
    pollC2Tasks,
    setupC2IndependentReviewSuite,
    type TaskItem,
} from '../support/c2-independent-review.ts';
import {
    messageTimeline,
    openChat,
    sendFromComposer,
    setTaskMode,
} from '../support/live-agent-app.ts';

/**
 * User story: consequential work passes from its author to a distinct verifier before
 * publication. The verifier must inspect the actual draft, remove unsupported claims,
 * and return the corrected result and remaining caveat to the coordinator.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(480_000);

let suite: Awaited<ReturnType<typeof setupC2IndependentReviewSuite>>;

test.beforeAll(async () => {
    suite = await setupC2IndependentReviewSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('coordinator passes an authored draft through a distinct independent verifier', async ({
    page,
}) => {
    const { author, channel, channelName, coordinator, harness, server, verifier } = suite;
    const authorMarker = `C2-AUTHOR-${harness.stamp}`;
    const verifierMarker = `C2-VERIFY-${harness.stamp}`;
    const prompt = [
        `@${coordinator.handle} Coordinate a reviewed Bluebird private-beta launch announcement in #${channelName}.`,
        `First create one task titled ${authorMarker} and assign it to @${author.handle}.`,
        'The author should draft 50–80 words using this product packet:',
        '- Approved: private beta opens October 15.',
        '- Approved: CSV import is supported.',
        '- Candidate claim: Bluebird cuts setup time by 50%.',
        '- Candidate claim: Bluebird is the #1 launch tool.',
        'Ask the author to put the exact draft between BEGIN CANDIDATE and END CANDIDATE in the task Thread.',
        `Wait for the authored draft. Only then create a second task titled ${verifierMarker}, assign it to @${verifier.handle}, and paste the author's exact candidate text into that task.`,
        'Ask the verifier to independently check every claim against the supplied packet, identify unsupported claims, and return a corrected announcement between BEGIN REVIEWED and END REVIEWED plus one remaining caveat.',
        `Wait for the verifier. Then publish the reviewed announcement in #${channelName} under REVIEWED ANNOUNCEMENT and the caveat under REMAINING CAVEAT. Do not self-certify the author's draft.`,
    ].join('\n');

    if (!coordinator.dmChatId) {
        throw new Error('C2 coordinator has no seeded Owner DM.');
    }
    await openChat(page, server.slug, coordinator.dmChatId, coordinator.displayName);
    await setTaskMode(page, false);
    await sendFromComposer(page, prompt);

    const authorTasks = await pollC2Tasks(harness, (items) =>
        items.some(
            (item) => hasC2Marker(item, authorMarker) && item.task.assigneeAgentId === author.id
        )
    );
    const authorTask = requireTask(authorTasks, authorMarker);
    expect(authorTask.task.assigneeAgentId).toBe(author.id);

    const authorMessages = await harness.pollMessages(
        authorTask.task.threadChatId,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === author.id &&
                    extractMarkedSection(message.content, 'BEGIN CANDIDATE', 'END CANDIDATE') !==
                        null
            ),
        300_000
    );
    const authorReply = authorMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === author.id &&
            extractMarkedSection(message.content, 'BEGIN CANDIDATE', 'END CANDIDATE') !== null
    );
    if (!authorReply) {
        throw new Error('Author did not return a marked candidate draft.');
    }
    const candidate = extractMarkedSection(authorReply.content, 'BEGIN CANDIDATE', 'END CANDIDATE');
    if (!candidate) {
        throw new Error('Author returned an empty candidate draft.');
    }

    const verifierTasks = await pollC2Tasks(harness, (items) =>
        items.some(
            (item) => hasC2Marker(item, verifierMarker) && item.task.assigneeAgentId === verifier.id
        )
    );
    const verifierTask = requireTask(verifierTasks, verifierMarker);
    expect(verifierTask.task.assigneeAgentId).toBe(verifier.id);
    expect(Date.parse(verifierTask.task.createdAt)).toBeGreaterThanOrEqual(
        Date.parse(authorReply.createdAt)
    );

    const verifierMessages = await harness.pollMessages(
        verifierTask.task.threadChatId,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinator.id &&
                    message.content.includes(candidate)
            ) &&
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === verifier.id &&
                    message.content.includes('BEGIN REVIEWED') &&
                    /50%/u.test(message.content) &&
                    /#1/u.test(message.content)
            ),
        300_000
    );
    expect(
        verifierMessages.some(
            (message) =>
                message.author.kind === 'agent' &&
                message.author.agentId === coordinator.id &&
                message.content.includes(candidate)
        )
    ).toBe(true);
    const verifierReply = verifierMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === verifier.id &&
            message.content.includes('BEGIN REVIEWED')
    );
    if (!verifierReply) {
        throw new Error('Verifier did not return a marked reviewed announcement.');
    }
    const reviewed = extractMarkedSection(verifierReply.content, 'BEGIN REVIEWED', 'END REVIEWED');
    expect(reviewed).toBeTruthy();
    expect(reviewed).toContain('October 15');
    expect(reviewed).toContain('CSV import');
    expect(reviewed).not.toMatch(/50%|#1/u);

    const parentMessages = await harness.pollMessages(
        channel,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinator.id &&
                    message.content.includes('REVIEWED ANNOUNCEMENT') &&
                    message.content.includes('REMAINING CAVEAT')
            ),
        360_000
    );
    const final = parentMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === coordinator.id &&
            message.content.includes('REVIEWED ANNOUNCEMENT') &&
            message.content.includes('REMAINING CAVEAT')
    );
    if (!final) {
        throw new Error('Coordinator did not publish the reviewed announcement.');
    }
    const published = final.content
        .split('REMAINING CAVEAT', 1)[0]
        .replace('REVIEWED ANNOUNCEMENT', '')
        .trim();
    const caveat = final.content.split('REMAINING CAVEAT', 2)[1]?.trim();
    expect(published).toContain('October 15');
    expect(published).toContain('CSV import');
    expect(published).not.toMatch(/50%|#1/u);
    expect(caveat).toBeTruthy();

    await openChat(page, server.slug, channel, channelName);
    const messages = messageTimeline(page);
    await expect(messages).toContainText('REVIEWED ANNOUNCEMENT');
    await expect(messages).toContainText('REMAINING CAVEAT');
    await expect(messages).toContainText('October 15');
    await expect(messages).toContainText('CSV import');
});

function requireTask(items: TaskItem[], marker: string) {
    const task = items.find((item) => hasC2Marker(item, marker));
    if (!task) {
        throw new Error(`Missing task ${marker}.`);
    }
    return task;
}
