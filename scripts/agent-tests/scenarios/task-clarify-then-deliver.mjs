// A claimed task waits for its missing input in the task Thread, uses the fresh
// answer, and only then hands the work to review. Ownership, Thread routing, and
// task state move together across two live turns.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent that needs missing input claims its task, asks in the task Thread before drafting, delivers the marked draft in that same Thread after the answer arrives, and leaves the task in_review still assigned to itself.',
    name: 'task-clarify-then-deliver',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const token = marker('AUDIENCE');

        const channel = await kit.createChannel({ agentIds: [worker.id] });
        log('sending task');
        const created = await kit.sendTask(
            channel.id,
            `@${worker.handle} Draft a two-sentence Bluebird launch blurb. Before drafting, ask me in this task Thread which audience to target; wait for my answer, then draft for that audience and move the task to review.`
        );

        const clarifying = await settleTurn(worker.id);
        expect(clarifying.status, 'clarification turn status').toBe('completed');
        expect(clarifying.failureKind ?? 'none', 'clarification turn failure kind').toBe('none');

        log('checking claim gates');
        const claimed = await kit.readTask(created.messageId);
        // An Agent that asked its question and paused may already have handed the
        // task to review; the contract here is claim-before-question, not the
        // transient state. The in_review gate after delivery still stands.
        expect(
            ['in_progress', 'in_review'].includes(claimed.status),
            `task status while clarifying left todo (got ${claimed.status})`
        ).toBe(true);
        expect(claimed.assigneeAgentId, 'task assignee while clarifying').toBe(worker.id);

        const questions = await clarifying.authoredMessagesIn(created.threadChatId);
        expect(questions.length > 0, 'the Agent asked in the task Thread').toBe(true);
        expect(
            Date.parse(claimed.claimedAt ?? '') <= Date.parse(questions[0].createdAt),
            'the task was claimed no later than its first Thread message'
        ).toBe(true);

        log('answering in the Thread');
        // A Thread reply is addressed to the parent chat plus its anchor message;
        // sending straight at the Thread chat is rejected.
        await kit.sendInThread(
            channel.id,
            created.messageId,
            `Target independent bookstore owners. Include the exact marker ${token} in the blurb.`
        );

        const delivering = await settleTurn(worker.id);
        expect(delivering.status, 'delivery turn status').toBe('completed');
        expect(delivering.failureKind ?? 'none', 'delivery turn failure kind').toBe('none');
        expect(delivering.outputProduced, 'delivery turn produced durable output').toBe(true);

        log('checking delivery gates');
        const drafts = await delivering.authoredMessagesIn(created.threadChatId);
        expect(
            drafts.map((message) => message.content),
            'drafts in the task Thread after the answer'
        ).toContain(token);

        const reviewed = await kit.readTask(created.messageId);
        expect(reviewed.status, 'task status after delivery').toBe('in_review');
        expect(reviewed.assigneeAgentId, 'task assignee after delivery').toBe(worker.id);
    },
});
