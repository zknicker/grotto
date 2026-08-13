// A task addressed to one Agent must be answered in the task Thread — not in
// the parent channel — and the Agent must take the task while it works.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'A task assigned to one Agent settles as in_progress with that Agent as assignee, is answered by exactly one message in the task Thread, leaves the parent channel silent, and the reply carries the requested marker.',
    name: 'task-thread-routing',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const token = marker();

        const channel = await kit.createChannel({ agentIds: [worker.id] });
        const channelHead = await kit.readHead(channel.id);
        log('sending task');

        const created = await kit.sendTask(
            channel.id,
            `@${worker.handle} Draft a two-sentence Bluebird launch blurb for independent bookstores. Include the exact marker ${token}.`
        );

        const turn = await settleTurn(worker.id);
        expect(turn.status, 'turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'turn failure kind').toBe('none');
        expect(turn.outputProduced, 'turn produced durable output').toBe(true);

        log('checking gates');
        const task = await kit.readTask(created.messageId);
        expect(task.status, 'task status').toBe('in_progress');
        expect(task.assigneeAgentId, 'task assignee').toBe(worker.id);

        const threadReplies = await turn.authoredMessagesIn(created.threadChatId);
        expect(threadReplies, 'replies in the task Thread').toHaveLength(1);
        expect(threadReplies[0].content, 'task Thread reply').toContain(token);

        const channelMessages = await kit.readMessages(channel.id);
        expect(
            kit.authoredBy(channelMessages, worker.id, channelHead),
            'replies in the parent channel'
        ).toHaveLength(0);
    },
});
