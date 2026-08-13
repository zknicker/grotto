// One Agent hands work to a peer in the same channel and only summarizes after
// the peer has answered. The ordering gate is the point: a summary written
// before the peer replied is a fabricated handoff.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'coordinator' }, { kind: 'worker' }],
    contract:
        'A coordinator asked to consult a peer produces at least one peer message in the channel and then a summary carrying the requested marker, authored no earlier than the peer reply.',
    name: 'peer-handoff',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [coordinator, worker] = agents;
        const token = marker('HANDOFF');

        const channel = await kit.createChannel({ agentIds: [coordinator.id, worker.id] });

        log('asking the coordinator to consult a peer');
        await kit.harness.send(
            channel.id,
            `@${coordinator.handle} Ask @${worker.handle} to pick the better Bluebird tagline between "Quiet launch, strong signal" and "The signal starts here" and give one sentence of reasoning in this channel. After they answer, post a summary that includes the exact marker ${token}.`
        );

        const turn = await settleTurn(coordinator.id);
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        // The coordinator may consult its peer in the channel or by creating a
        // task for it; the peer then answers in that task Thread. Both are real
        // handoffs, so both containers count for the peer reply and the summary.
        log('waiting for the peer reply');
        const peerReply = await kit.awaitAgentReply(channel.id, worker.id, () => true, 300_000);

        log('waiting for the coordinator summary');
        const summary = await kit.awaitAgentReply(
            channel.id,
            coordinator.id,
            (message) => message.content.includes(token),
            300_000
        );

        log('checking gates');
        expect(summary.message.content, 'coordinator summary').toContain(token);
        expect(
            Date.parse(summary.message.createdAt) >= Date.parse(peerReply.message.createdAt),
            'summary authored no earlier than the peer reply'
        ).toBe(true);
    },
});
