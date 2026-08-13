// What a verifier approved is what gets published. With the approval already
// recorded in the review task Thread, the coordinator republishes that exact
// sentence in the channel instead of a reworded stand-in.

import { threadTarget } from '../author.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }],
    contract:
        'With an approved revision recorded in the review task Thread, the coordinator publishes exactly one channel message that carries the approved sentence verbatim, marker included.',
    name: 'publish-only-after-approval',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [coordinator, verifier] = agents;
        const laneB = marker('REVIEW');
        const revisionMarker = marker('REV');
        const revision = `${revisionMarker} Bluebird private beta opens October 15. CSV import is supported.`;

        const channel = await kit.createChannel({ agentIds: [coordinator.id, verifier.id] });

        log('seeding the recorded approval');
        const reviewTask = await kit.sendTask(
            channel.id,
            [
                `${laneB} Review lane for the Bluebird private-beta announcement.`,
                `Lane owner: ${verifier.handle}. The review is already recorded in this task Thread, so nobody needs to pick it up.`,
            ].join('\n')
        );
        await kit.authorAsAgent(
            verifier.id,
            threadTarget(channel.name, reviewTask.messageId),
            `APPROVED EXACT REVISION: ${revision}`,
            { chatId: channel.id }
        );

        log('waiting for the seeded context to go quiet');
        for (const agent of agents) {
            await kit.harness.waitForAgentQuiet(agent.id, 4000, 180_000);
        }

        log('asking for publication');
        await kit.harness.send(
            channel.id,
            [
                `@${coordinator.handle} The verifier has approved the revision in task ${laneB}.`,
                'Publish the approved revision in this channel exactly as approved, unchanged.',
                'Do not reword, shorten, extend, or re-run the review.',
            ].join('\n')
        );

        const turn = await settleTurn(coordinator.id, { settleWithin: 300_000 });
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        log('checking gates');
        const published = await turn.authoredMessagesIn(channel.id);
        const carrying = published.filter((message) => message.content.includes(revisionMarker));
        expect(carrying, 'coordinator channel messages carrying the approved marker').toHaveLength(
            1
        );
        expect(carrying[0].content, 'published revision').toContain(revision);
    },
});
