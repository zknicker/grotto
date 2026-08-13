// Review of a draft belongs to someone other than its author. Given a finished
// candidate in the author's task Thread, the coordinator opens review work owned
// by the verifier — never the author — and hands the exact draft along.

import { threadTarget } from '../author.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }, { kind: 'worker' }],
    contract:
        'Given an authored candidate draft, the coordinator assigns review to the verifier and never to the draft author: a task it creates is owned by the verifier and carries the candidate marker in its message or Thread.',
    name: 'verifier-task-is-distinct',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [coordinator, author, verifier] = agents;
        const laneA = marker('AUTHOR');
        const draft = marker('DRAFT');
        const candidate = `BEGIN CANDIDATE ${draft} Bluebird opens its private beta October 15 with CSV import. END CANDIDATE`;

        const channel = await kit.createChannel({
            agentIds: [coordinator.id, author.id, verifier.id],
        });

        log('seeding the authored candidate');
        const authorTask = await kit.sendTask(
            channel.id,
            [
                `${laneA} Author lane for the Bluebird private-beta announcement.`,
                `Lane owner: ${author.handle}. The candidate draft is already filed in this task Thread, so nobody needs to pick it up.`,
            ].join('\n')
        );
        await kit.authorAsAgent(
            author.id,
            threadTarget(channel.name, authorTask.messageId),
            candidate,
            { chatId: channel.id }
        );

        log('waiting for the seeded context to go quiet');
        for (const agent of agents) {
            await kit.harness.waitForAgentQuiet(agent.id, 4000, 180_000);
        }

        log('asking for the review lane');
        await kit.harness.send(
            channel.id,
            [
                `@${coordinator.handle} The candidate draft in task ${laneA} is ready in that task's Thread.`,
                `Create exactly one review task in this channel assigned to @${verifier.handle}. It must not be assigned to @${author.handle}, who wrote the draft.`,
                'Include the exact candidate text between BEGIN CANDIDATE and END CANDIDATE in the review task body or in its task Thread.',
                'Do not review the draft yourself.',
            ].join('\n')
        );

        const turn = await settleTurn(coordinator.id, { settleWithin: 300_000 });
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        log('checking gates');
        // A coordinator may split its own bookkeeping across several tasks; the
        // contract is who reviews, not how many tasks it took to get there.
        const tasks = await kit.trpc('task.list', { chatId: channel.id, serverId: kit.serverId });
        const created = tasks.filter((item) => item.task.messageId !== authorTask.messageId);
        expect(created.length > 0, 'tasks created by the coordinator').toBe(true);
        expect(
            created.some((item) => item.task.assigneeAgentId === author.id),
            'a created task was assigned to the draft author'
        ).toBe(false);

        let reviewCarryingDraft = null;
        for (const item of created) {
            await kit.trackChat(item.task.threadChatId);
            if (item.task.assigneeAgentId !== verifier.id) {
                continue;
            }
            const thread = await kit.readMessages(item.task.threadChatId);
            const carriesDraft =
                item.message.content.includes(draft) ||
                thread.some((message) => message.content.includes(draft));
            if (carriesDraft) {
                reviewCarryingDraft = item;
            }
        }
        expect(
            Boolean(reviewCarryingDraft),
            'a review task assigned to the verifier carries the candidate draft'
        ).toBe(true);
    },
});
