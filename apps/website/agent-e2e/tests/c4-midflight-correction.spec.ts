import { expect, test } from '@playwright/test';
import {
    findC4Task,
    pollC4Tasks,
    setupC4MidflightCorrectionSuite,
    type TaskItem,
} from '../support/c4-midflight-correction.ts';
import { openChat, sendFromComposer } from '../support/live-agent-app.ts';

const completeExportPattern =
    /complete (?:standard-format export|export in (?:a )?standard format)/iu;
const candidateSelectionPattern =
    /(?:recommend(?:ed|ation)?|select(?:ed|ion)?|choose|chosen|prefer(?:red|ence)?|favou?r(?:ed|s)?|pick(?:ed)?|winner|(?:best|better) (?:choice|option|fit|candidate)|go with)[^.!?\n]{0,80}(?:Northstar|Atlas)|(?:Northstar|Atlas)[^.!?\n]{0,80}(?:recommended|selection|selected|chosen|preferred|favou?red|pick|winner|(?:best|better) (?:choice|option|fit|candidate))/iu;

test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

let suite: Awaited<ReturnType<typeof setupC4MidflightCorrectionSuite>>;

test.beforeAll(async () => {
    suite = await setupC4MidflightCorrectionSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('coordinator propagates a material correction before synthesizing active lanes', async ({
    page,
}) => {
    const { atlas, channel, channelName, coordinator, harness, northstar, server } = suite;
    const northstarMarker = `C4-NORTHSTAR-${harness.stamp}`;
    const atlasMarker = `C4-ATLAS-${harness.stamp}`;
    const correctionMarker = `C4-CORRECTION-${harness.stamp}`;
    const initialPrompt = [
        `@${coordinator.handle} Coordinate a knowledge-base selection in #${channelName}, but do not choose a product yet.`,
        `Create exactly two independently owned tasks: ${northstarMarker} assigned to @${northstar.handle}, and ${atlasMarker} assigned to @${atlas.handle}.`,
        `In ${northstarMarker}, ask the lane to evaluate Northstar from this packet: strongest editor and user onboarding; price is acceptable; residency and export are not yet documented.`,
        `In ${atlasMarker}, ask the lane to evaluate Atlas from this packet: strongest admin controls and permissions; price is acceptable; residency and export are not yet documented.`,
        'Tell each lane to claim its task, reply BASELINE RECEIVED, keep the task in progress, and wait for an owner requirements lock before returning a final finding.',
        'Wait for both acknowledgements. Do not publish an initial recommendation or select either candidate in the parent Channel while owner requirements are still open.',
    ].join('\n');

    if (!coordinator.dmChatId) {
        throw new Error('C4 coordinator has no seeded Owner DM.');
    }
    await openChat(page, server.slug, coordinator.dmChatId, coordinator.displayName);
    const taskMode = page.getByRole('checkbox', { name: 'As Task' });
    if (await taskMode.isChecked()) {
        await taskMode.uncheck();
    }
    await sendFromComposer(page, initialPrompt);

    const createdTasks = await pollC4Tasks(harness, (items) => {
        const northstarTask = findC4Task(items, northstarMarker);
        const atlasTask = findC4Task(items, atlasMarker);
        return (
            northstarTask?.task.assigneeAgentId === northstar.id &&
            atlasTask?.task.assigneeAgentId === atlas.id
        );
    });
    const northstarTask = requireTask(createdTasks, northstarMarker);
    const atlasTask = requireTask(createdTasks, atlasMarker);

    const [northstarBaseline, atlasBaseline] = await Promise.all([
        waitForBaseline(harness, northstarTask, northstar.id),
        waitForBaseline(harness, atlasTask, atlas.id),
    ]);
    const activeTasks = await pollC4Tasks(harness, (items) => {
        const northstarCurrent = findC4Task(items, northstarMarker);
        const atlasCurrent = findC4Task(items, atlasMarker);
        return (
            northstarCurrent?.task.status === 'in_progress' &&
            atlasCurrent?.task.status === 'in_progress'
        );
    });
    expect(findC4Task(activeTasks, northstarMarker)?.task.status).toBe('in_progress');
    expect(findC4Task(activeTasks, atlasMarker)?.task.status).toBe('in_progress');

    const beforeCorrection = await harness.readMessages(channel);
    expect(coordinatorMessages(beforeCorrection, coordinator.id)).not.toMatch(
        candidateSelectionPattern
    );

    const correctionPrompt = [
        correctionMarker,
        'Material correction: EU data residency and complete standard-format export are now hard requirements, not preferences.',
        'Propagate this correction to every still-active candidate task before accepting either final finding.',
        'Ask both lanes to revise against both hard gates and label the response REVISED FINDING.',
        'Withhold every recommendation based only on the original criteria.',
        `After both revised findings arrive, publish one synthesis in #${channelName} under CORRECTED RECOMMENDATION.`,
        'If the supplied evidence proves neither candidate meets both gates, say SELECT NEITHER YET and require a legal acceptance test before selection.',
    ].join('\n');
    await sendFromComposer(page, correctionPrompt);

    const correctionDm = (await harness.readMessages(coordinator.dmChatId)).find(
        (message) => message.author.kind === 'human' && message.content.includes(correctionMarker)
    );
    if (!correctionDm) {
        throw new Error('C4 correction was not durably accepted from the App composer.');
    }

    const [northstarRevision, atlasRevision] = await Promise.all([
        waitForRevision(harness, northstarTask, northstar.id, coordinator.id, correctionMarker),
        waitForRevision(harness, atlasTask, atlas.id, coordinator.id, correctionMarker),
    ]);
    for (const lane of [northstarRevision, atlasRevision]) {
        expect(Date.parse(lane.propagation.createdAt)).toBeGreaterThanOrEqual(
            Date.parse(correctionDm.createdAt)
        );
        expect(Date.parse(lane.revision.createdAt)).toBeGreaterThanOrEqual(
            Date.parse(lane.propagation.createdAt)
        );
        expect(lane.propagation.content).toMatch(/EU data residency/iu);
        expect(lane.propagation.content).toMatch(completeExportPattern);
        expect(lane.revision.content).toMatch(/REVISED FINDING/iu);
        expect(lane.revision.content).toMatch(/EU data residency/iu);
        expect(lane.revision.content).toMatch(completeExportPattern);
    }
    expect(Date.parse(northstarBaseline.createdAt)).toBeLessThan(
        Date.parse(correctionDm.createdAt)
    );
    expect(Date.parse(atlasBaseline.createdAt)).toBeLessThan(Date.parse(correctionDm.createdAt));

    const parentMessages = await harness.pollMessages(
        channel,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinator.id &&
                    message.content.includes('CORRECTED RECOMMENDATION') &&
                    /SELECT NEITHER YET/iu.test(message.content)
            ),
        360_000
    );
    const synthesis = parentMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === coordinator.id &&
            message.content.includes('CORRECTED RECOMMENDATION')
    );
    if (!synthesis) {
        throw new Error('C4 coordinator did not publish a corrected synthesis.');
    }
    expect(Date.parse(synthesis.createdAt)).toBeGreaterThanOrEqual(
        Math.max(
            Date.parse(northstarRevision.revision.createdAt),
            Date.parse(atlasRevision.revision.createdAt)
        )
    );
    expect(synthesis.content).toMatch(/SELECT NEITHER YET/iu);
    expect(synthesis.content).toMatch(/EU data residency/iu);
    expect(synthesis.content).toMatch(completeExportPattern);
    expect(synthesis.content).toMatch(/legal acceptance test/iu);
    expect(
        coordinatorMessages(
            parentMessages.filter(
                (message) => Date.parse(message.createdAt) < Date.parse(synthesis.createdAt)
            ),
            coordinator.id
        )
    ).not.toMatch(candidateSelectionPattern);

    await openChat(page, server.slug, channel, channelName);
    const messages = page.getByLabel('Messages');
    await expect(messages).toContainText('CORRECTED RECOMMENDATION');
    await expect(messages).toContainText('SELECT NEITHER YET');
    await expect(messages).toContainText('EU data residency');
    await expect(messages).toContainText(completeExportPattern);
});

async function waitForBaseline(
    harness: Awaited<ReturnType<typeof setupC4MidflightCorrectionSuite>>['harness'],
    task: TaskItem,
    agentId: string
) {
    const messages = await harness.pollMessages(
        task.task.threadChatId,
        (items) =>
            items.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === agentId &&
                    message.content.includes('BASELINE RECEIVED')
            ),
        300_000
    );
    const baseline = messages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === agentId &&
            message.content.includes('BASELINE RECEIVED')
    );
    if (!baseline) {
        throw new Error(`C4 lane ${agentId} did not acknowledge its baseline.`);
    }
    return baseline;
}

async function waitForRevision(
    harness: Awaited<ReturnType<typeof setupC4MidflightCorrectionSuite>>['harness'],
    task: TaskItem,
    agentId: string,
    coordinatorId: string,
    correctionMarker: string
) {
    const messages = await harness.pollMessages(
        task.task.threadChatId,
        (items) =>
            items.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === coordinatorId &&
                    message.content.includes(correctionMarker)
            ) &&
            items.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === agentId &&
                    message.content.includes('REVISED FINDING')
            ),
        300_000
    );
    const propagation = messages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === coordinatorId &&
            message.content.includes(correctionMarker)
    );
    const revision = messages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === agentId &&
            message.content.includes('REVISED FINDING')
    );
    if (!(propagation && revision)) {
        throw new Error(`C4 lane ${agentId} did not receive and revise for the correction.`);
    }
    return { propagation, revision };
}

function requireTask(items: TaskItem[], marker: string) {
    const task = findC4Task(items, marker);
    if (!task) {
        throw new Error(`Missing task ${marker}.`);
    }
    return task;
}

function coordinatorMessages(
    messages: Array<{
        author: { agentId?: string; kind: string };
        content: string;
    }>,
    coordinatorId: string
) {
    return messages
        .filter(
            (message) => message.author.kind === 'agent' && message.author.agentId === coordinatorId
        )
        .map((message) => message.content)
        .join('\n');
}
