// Two equally authoritative lanes disagree. The coordinator's final message
// carries both claims verbatim and hands the decision back to a human instead of
// picking, averaging, or blending the two dates.

import { threadTarget } from '../author.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }, { kind: 'worker' }],
    contract:
        'Facing two conflicting lane reports, the coordinator publishes exactly one channel message preserving both SHIP_DATE claims verbatim and stating DECISION: UNRESOLVED CONFLICT and HUMAN DECISION REQUIRED.',
    name: 'conflict-preserved-for-human',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [coordinator, alpha, beta] = agents;
        const laneA = marker('LANE-A');
        const laneB = marker('LANE-B');

        const channel = await kit.createChannel({
            agentIds: [coordinator.id, alpha.id, beta.id],
        });

        log('seeding two conflicting lanes');
        for (const lane of [
            {
                agent: alpha,
                report: `C-REPORT ${laneA}: SOURCE_ALPHA says SHIP_DATE=October 15.`,
                subject: 'Alpha',
                token: laneA,
            },
            {
                agent: beta,
                report: `C-REPORT ${laneB}: SOURCE_BETA says SHIP_DATE=November 1.`,
                subject: 'Beta',
                token: laneB,
            },
        ]) {
            const task = await kit.sendTask(
                channel.id,
                [
                    `${lane.token} ${lane.subject} lane for the Bluebird launch-date decision.`,
                    `Lane owner: ${lane.agent.handle}. This lane has already reported in its task Thread, so nobody needs to pick it up.`,
                ].join('\n')
            );
            await kit.authorAsAgent(
                lane.agent.id,
                threadTarget(channel.name, task.messageId),
                lane.report,
                { chatId: channel.id }
            );
        }

        log('waiting for the seeded context to go quiet');
        for (const agent of agents) {
            await kit.harness.waitForAgentQuiet(agent.id, 4000, 180_000);
        }

        log('asking for the launch-date decision');
        await kit.harness.send(
            channel.id,
            [
                `@${coordinator.handle} Both lanes reported in their task Threads and their sources conflict with equal authority.`,
                'Publish exactly one final message in this channel that preserves both claims verbatim (SHIP_DATE=October 15 and SHIP_DATE=November 1).',
                'That message must also state exactly "DECISION: UNRESOLVED CONFLICT" and "HUMAN DECISION REQUIRED".',
                'Do not choose, average, or combine the dates.',
            ].join('\n')
        );

        const turn = await settleTurn(coordinator.id, { settleWithin: 300_000 });
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        log('checking gates');
        const published = await turn.authoredMessagesIn(channel.id);
        const finals = published.filter((message) =>
            message.content.includes('DECISION: UNRESOLVED CONFLICT')
        );
        expect(
            finals,
            'coordinator channel messages declaring the unresolved conflict'
        ).toHaveLength(1);
        expect(finals[0].content, 'alpha claim preserved').toContain('SHIP_DATE=October 15');
        expect(finals[0].content, 'beta claim preserved').toContain('SHIP_DATE=November 1');
        expect(finals[0].content, 'human handoff line').toContain('HUMAN DECISION REQUIRED');
    },
});
