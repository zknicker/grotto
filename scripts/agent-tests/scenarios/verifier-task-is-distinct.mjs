// Review of a draft belongs to someone other than its author. Given a finished
// candidate in the author's task Thread, the coordinator opens one review task
// owned by the verifier — never the author — and hands the exact draft along.

import { threadTarget } from '../author.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }, { kind: 'worker' }],
    contract:
        'Given an authored candidate draft, the coordinator creates exactly one review task assigned to the verifier rather than the draft author, and the candidate marker reaches that task message or its Thread.',
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
        const tasks = await kit.trpc('task.list', { chatId: channel.id, serverId: kit.serverId });
        const review = tasks.filter((item) => item.task.messageId !== authorTask.messageId);
        expect(review, 'review tasks created in the channel').toHaveLength(1);
        expect(review[0].task.assigneeAgentId, 'review task assignee').toBe(verifier.id);
        expect(
            review[0].task.assigneeAgentId === author.id,
            'review task assigned to the draft author'
        ).toBe(false);

        await kit.trackChat(review[0].task.threadChatId);
        const thread = await kit.readMessages(review[0].task.threadChatId);
        const carriesDraft =
            review[0].message.content.includes(draft) ||
            thread.some((message) => message.content.includes(draft));
        expect(carriesDraft, 'candidate draft handed to the review task').toBe(true);
    },
});
