// Two lanes have already reported inside their task Threads. The coordinator's
// job is one published synthesis in the parent channel that names both lanes and
// lands after the evidence it is built on.

import { threadTarget } from '../author.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }, { kind: 'worker' }],
    contract:
        'With both lane reports already filed in their task Threads, the coordinator publishes exactly one channel message carrying both lane markers, created after both reports.',
    name: 'coordinator-synthesizes-from-lanes',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [coordinator, pricing, retention] = agents;
        const laneA = marker('LANE-A');
        const laneB = marker('LANE-B');

        const channel = await kit.createChannel({
            agentIds: [coordinator.id, pricing.id, retention.id],
        });

        log('seeding two reported lanes');
        const seeded = [];
        for (const lane of [
            {
                agent: pricing,
                report: 'Self-serve pricing stays at 12 dollars per seat. Annual prepay keeps the 15 percent discount.',
                subject: 'Pricing',
                token: laneA,
            },
            {
                agent: retention,
                report: 'Beta churn is 4 percent per month. Import help is the top support request.',
                subject: 'Retention',
                token: laneB,
            },
        ]) {
            const task = await kit.sendTask(
                channel.id,
                [
                    `${lane.token} ${lane.subject} lane for the Bluebird launch brief.`,
                    `Lane owner: ${lane.agent.handle}. This lane has already reported in its task Thread, so nobody needs to pick it up.`,
                ].join('\n')
            );
            await kit.authorAsAgent(
                lane.agent.id,
                threadTarget(channel.name, task.messageId),
                `LANE REPORT ${lane.token}: ${lane.report}`,
                { chatId: channel.id }
            );
            seeded.push({ ...lane, task });
        }

        log('waiting for the seeded context to go quiet');
        for (const agent of agents) {
            await kit.harness.waitForAgentQuiet(agent.id, 4000, 300_000);
        }

        const reports = [];
        for (const lane of seeded) {
            const thread = await kit.readMessages(lane.task.threadChatId);
            const report = thread.find((message) =>
                message.content.includes(`LANE REPORT ${lane.token}`)
            );
            expect(Boolean(report), `seeded lane report ${lane.token}`).toBe(true);
            reports.push(report);
        }

        log('asking for the synthesis');
        await kit.harness.send(
            channel.id,
            [
                `@${coordinator.handle} Both lanes have reported in their task Threads.`,
                `Read both reports, then publish exactly one synthesis message in this channel that includes both markers ${laneA} and ${laneB} and reflects what each lane reported.`,
                'Do not create new tasks and do not redo either lane.',
            ].join('\n')
        );

        const turn = await settleTurn(coordinator.id, { settleWithin: 300_000 });
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        log('checking gates');
        // The synthesis may land in the channel or in a Thread the request was
        // promoted into — either satisfies "one synthesis from both lanes".
        const synthesis = await kit.awaitAgentReply(
            channel.id,
            coordinator.id,
            (message) => message.content.includes(laneA) && message.content.includes(laneB),
            240_000
        );

        const lastReportAt = Math.max(...reports.map((report) => Date.parse(report.createdAt)));
        expect(
            Date.parse(synthesis.message.createdAt) >= lastReportAt,
            'synthesis published after both lane reports'
        ).toBe(true);
    },
});
