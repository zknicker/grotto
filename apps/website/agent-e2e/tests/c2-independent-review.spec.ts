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
 * publication. The verifier reports findings without rewriting, the author revises,
 * and the verifier approves the exact version that the coordinator publishes.
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
        `First create one task titled ${authorMarker}, assign it to @${author.handle}, and include this complete product packet in that task:`,
        '- Approved: private beta opens October 15.',
        '- Approved: CSV import is supported.',
        '- Candidate claim: Bluebird cuts setup time by 50%.',
        '- Candidate claim: Bluebird is the #1 launch tool.',
        'Ask the author to put the exact draft between BEGIN CANDIDATE and END CANDIDATE in the task Thread.',
        `Wait for the authored draft. Only then create a second task titled ${verifierMarker}, assign it to @${verifier.handle}, and paste both the author's exact candidate and the complete product packet above into that task.`,
        'Ask the verifier to independently check every claim against the supplied packet and report issues between BEGIN FINDINGS and END FINDINGS. The verifier must not rewrite the announcement.',
        `Wait for the findings. Paste them into the ${authorMarker} task Thread and ask @${author.handle} for a corrected version between BEGIN REVISION and END REVISION.`,
        `Wait for the revision. Paste that exact revision into the ${verifierMarker} task Thread and ask @${verifier.handle} to reply APPROVED EXACT REVISION if it resolves every finding, or return new findings without rewriting it.`,
        `Only after approval, publish that exact revision unchanged in #${channelName} under REVIEWED ANNOUNCEMENT, followed by the remaining caveat under REMAINING CAVEAT. Do not self-certify or rewrite the author's revision.`,
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
                    message.author.agentId === verifier.id &&
                    message.content.includes('BEGIN FINDINGS')
            ),
        300_000
    );
    const candidateHandoff =
        verifierTask.message.content.includes(candidate) ||
        verifierMessages.some(
            (message) =>
                message.author.kind === 'agent' &&
                message.author.agentId === coordinator.id &&
                message.content.includes(candidate)
        );
    expect(candidateHandoff).toBe(true);
    const verifierReply = verifierMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === verifier.id &&
            message.content.includes('BEGIN FINDINGS')
    );
    if (!verifierReply) {
        throw new Error('Verifier did not return marked findings.');
    }
    const findings = extractMarkedSection(verifierReply.content, 'BEGIN FINDINGS', 'END FINDINGS');
    if (!findings) {
        throw new Error('Verifier returned empty findings.');
    }
    expect(findings).toMatch(/50%|setup time/iu);
    expect(findings).toMatch(/#1|launch tool|superlative/iu);

    const revisedMessages = await harness.pollMessages(
        authorTask.task.threadChatId,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinator.id &&
                    message.content.includes(findings)
            ) &&
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === author.id &&
                    message.content.includes('BEGIN REVISION')
            ),
        300_000
    );
    const revisionReply = revisedMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === author.id &&
            message.content.includes('BEGIN REVISION')
    );
    const revision = revisionReply
        ? extractMarkedSection(revisionReply.content, 'BEGIN REVISION', 'END REVISION')
        : null;
    if (!revision) {
        throw new Error('Author did not return a marked revision.');
    }
    expect(revision).toContain('October 15');
    expect(revision).toContain('CSV import');
    expect(revision).not.toMatch(/50%|#1/u);

    const approvalMessages = await harness.pollMessages(
        verifierTask.task.threadChatId,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinator.id &&
                    message.content.includes(revision)
            ) &&
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === verifier.id &&
                    message.content.includes('APPROVED EXACT REVISION')
            ),
        300_000
    );
    expect(
        approvalMessages.some(
            (message) =>
                message.author.kind === 'agent' &&
                message.author.agentId === verifier.id &&
                message.content.includes('APPROVED EXACT REVISION')
        )
    ).toBe(true);

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
    expect(published).toBe(revision);
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
