// A material correction has to reach the people still working before it reaches
// the audience. Both active lanes get the correction in their own task Threads,
// and any channel post from the same turn comes after those Thread posts.

import { threadTarget } from '../author.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }, { kind: 'worker' }],
    contract:
        'Given a material correction, the coordinator gets it — marker included — into both active task Threads, and any channel post in the same turn is created no earlier than both Thread posts.',
    name: 'correction-reaches-lanes-before-synthesis',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [coordinator, northstar, atlas] = agents;
        const laneA = marker('LANE-A');
        const laneB = marker('LANE-B');
        const correction = marker('CORRECTION');

        const channel = await kit.createChannel({
            agentIds: [coordinator.id, northstar.id, atlas.id],
        });

        log('seeding two baselined lanes');
        const seeded = [];
        for (const lane of [
            {
                agent: northstar,
                baseline:
                    'Northstar has the strongest editor and onboarding. Residency and export are undocumented.',
                subject: 'Northstar',
                token: laneA,
            },
            {
                agent: atlas,
                baseline:
                    'Atlas has the strongest admin controls. Residency and export are undocumented.',
                subject: 'Atlas',
                token: laneB,
            },
        ]) {
            const task = await kit.sendTask(
                channel.id,
                [
                    `${lane.token} ${lane.subject} evaluation lane for the knowledge-base selection.`,
                    `Lane owner: ${lane.agent.handle}. The baseline is already filed in this task Thread and the lane is waiting on an owner requirements lock.`,
                ].join('\n')
            );
            await kit.authorAsAgent(
                lane.agent.id,
                threadTarget(channel.name, task.messageId),
                `BASELINE REPORT ${lane.token}: ${lane.baseline}`,
                { chatId: channel.id }
            );
            seeded.push({ ...lane, task });
        }

        log('waiting for the seeded context to go quiet');
        for (const agent of agents) {
            await kit.harness.waitForAgentQuiet(agent.id, 4000, 180_000);
        }

        log('sending the material correction');
        await kit.harness.send(
            channel.id,
            [
                `@${coordinator.handle} Material correction, marker ${correction}: EU data residency is now a hard requirement, not a preference.`,
                `Before posting anything in this channel, post the correction including the exact marker ${correction} into BOTH task Threads (${laneA} and ${laneB}).`,
                'Both lanes are still active, so they must have the new requirement before anything else happens.',
            ].join('\n')
        );

        const turn = await settleTurn(coordinator.id, { settleWithin: 300_000 });
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        log('checking gates');
        // The marker is unpredictable and known only to the coordinator, so its
        // presence in a lane Thread proves the coordinator propagated it — even
        // when the visible message is a lane owner echoing the handoff. Only the
        // harness human is excluded, since it never wrote the marker there.
        const propagated = [];
        for (const lane of seeded) {
            const thread = await kit.readMessages(lane.task.threadChatId);
            const posts = thread.filter(
                (message) => message.author.kind !== 'human' && message.content.includes(correction)
            );
            expect(posts.length > 0, `the correction reached task Thread ${lane.token}`).toBe(true);
            propagated.push(Math.min(...posts.map((post) => Date.parse(post.createdAt))));
        }

        const channelPosts = await turn.authoredMessagesIn(channel.id);
        const lastPropagatedAt = Math.max(...propagated);
        const earliestChannelAt = Math.min(
            ...channelPosts.map((message) => Date.parse(message.createdAt))
        );
        expect(
            channelPosts.length === 0 || earliestChannelAt >= lastPropagatedAt,
            'both Thread corrections precede any channel post from this turn'
        ).toBe(true);
    },
});
