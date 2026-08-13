// A coordinator asked to divide work must route it, not absorb it: two owned
// task lanes with the requested first lines, one per named worker, and nothing
// authored by the coordinator inside either task Thread.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }, { kind: 'worker' }],
    contract:
        'A coordinator told to split work into two owned lanes creates exactly two channel tasks whose first lines carry the requested markers, assigns each to the named worker, and authors nothing inside either task Thread.',
    name: 'coordinator-assigns-not-performs',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [coordinator, first, second] = agents;
        const laneA = marker('LANE-A');
        const laneB = marker('LANE-B');

        const channel = await kit.createChannel({
            agentIds: [coordinator.id, first.id, second.id],
        });

        log('sending the delegation request');
        await kit.harness.send(
            channel.id,
            [
                `@${coordinator.handle} We are splitting Bluebird launch prep into two independently owned lanes.`,
                `Create exactly two tasks in this channel: one whose first line is exactly ${laneA} assigned to @${first.handle}, and one whose first line is exactly ${laneB} assigned to @${second.handle}.`,
                'Do not do either piece of work yourself and do not post a recommendation.',
                'Do not post anything inside either task Thread — the owners work their own lanes.',
            ].join('\n')
        );

        const turn = await settleTurn(coordinator.id, { settleWithin: 300_000 });
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        log('checking gates');
        const tasks = await kit.trpc('task.list', { chatId: channel.id, serverId: kit.serverId });
        const lanes = [findLane(tasks, laneA), findLane(tasks, laneB)].filter(Boolean);
        expect(lanes, 'lane tasks created in the channel').toHaveLength(2);
        expect(lanes[0].task.assigneeAgentId, `${laneA} assignee`).toBe(first.id);
        expect(lanes[1].task.assigneeAgentId, `${laneB} assignee`).toBe(second.id);

        for (const lane of lanes) {
            await kit.trackChat(lane.task.threadChatId);
            const thread = await kit.readMessages(lane.task.threadChatId);
            expect(
                kit.authoredBy(thread, coordinator.id),
                `coordinator messages inside task Thread #${lane.task.number}`
            ).toHaveLength(0);
        }
    },
});

function findLane(tasks, token) {
    return tasks.find((item) => firstLine(item.message.content).includes(token));
}

function firstLine(content) {
    return content.split('\n', 1)[0].trim();
}
