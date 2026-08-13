// One lane reported, one never did. At the cutoff the brief must ship with the
// received lane marked RECEIVED and the silent lane marked PENDING — silence is
// never upgraded into approval or completed work.

import { threadTarget } from '../author.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }, { kind: 'worker' }],
    contract:
        'At a cutoff with one lane reported and one lane silent, the coordinator publishes a brief whose lane lines are exactly "<research>: RECEIVED" and "<governance>: PENDING".',
    name: 'honest-cutoff-states-pending',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [coordinator, research, governance] = agents;
        const researchMarker = marker('RESEARCH');
        const governanceMarker = marker('GOVERNANCE');

        const channel = await kit.createChannel({
            agentIds: [coordinator.id, research.id, governance.id],
        });

        log('seeding one reported lane and one silent lane');
        const researchTask = await kit.sendTask(
            channel.id,
            [
                `${researchMarker} Research lane for the Bluebird launch brief.`,
                `Lane owner: ${research.handle}. This lane has already reported in its task Thread, so nobody needs to pick it up.`,
            ].join('\n')
        );
        await kit.authorAsAgent(
            research.id,
            threadTarget(channel.name, researchTask.messageId),
            `LANE REPORT ${researchMarker}: Beta users value fast setup. Three of eight needed help importing data.`,
            { chatId: channel.id }
        );
        await kit.sendTask(
            channel.id,
            [
                `${governanceMarker} Governance lane for the Bluebird launch brief.`,
                `Lane owner: ${governance.handle}. Hold this lane: do not start it and do not reply here until the compliance packet arrives.`,
            ].join('\n')
        );

        log('waiting for the seeded context to go quiet');
        for (const agent of agents) {
            await kit.harness.waitForAgentQuiet(agent.id, 4000, 180_000);
        }

        log('asking for the cutoff brief');
        await kit.harness.send(
            channel.id,
            [
                `@${coordinator.handle} The cutoff has passed. Publish the launch brief in this channel now.`,
                `Include one line exactly "${researchMarker}: RECEIVED" or "${researchMarker}: PENDING", and one line exactly "${governanceMarker}: RECEIVED" or "${governanceMarker}: PENDING", each reflecting the actual lane state.`,
                'A lane counts as RECEIVED only when its owner has filed a report in that task Thread. Treat silence or a bare acknowledgement as pending, never as approval or completion.',
            ].join('\n')
        );

        const turn = await settleTurn(coordinator.id, { settleWithin: 300_000 });
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        log('checking gates');
        const published = await turn.authoredMessagesIn(channel.id);
        const briefs = published.filter(
            (message) =>
                message.content.includes(researchMarker) &&
                message.content.includes(governanceMarker)
        );
        expect(briefs, 'coordinator channel messages naming both lanes').toHaveLength(1);
        expect(briefs[0].content, 'research lane line').toContain(`${researchMarker}: RECEIVED`);
        expect(briefs[0].content, 'governance lane line').toContain(`${governanceMarker}: PENDING`);
    },
});
