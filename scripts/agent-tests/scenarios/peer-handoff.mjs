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
        const head = await kit.readHead(channel.id);

        log('asking the coordinator to consult a peer');
        await kit.harness.send(
            channel.id,
            `@${coordinator.handle} Ask @${worker.handle} to pick the better Bluebird tagline between "Quiet launch, strong signal" and "The signal starts here" and give one sentence of reasoning in this channel. After they answer, post a summary that includes the exact marker ${token}.`
        );

        const turn = await settleTurn(coordinator.id);
        expect(turn.status, 'coordinator turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'coordinator turn failure kind').toBe('none');

        log('waiting for the peer reply');
        const peerReply = await kit.awaitMessage(
            channel.id,
            (message) => authoredBy(message, worker.id) && message.sequence > head,
            240_000
        );

        log('waiting for the coordinator summary');
        const summary = await kit.awaitMessage(
            channel.id,
            (message) =>
                authoredBy(message, coordinator.id) &&
                message.sequence > head &&
                message.content.includes(token),
            240_000
        );

        log('checking gates');
        const peerMessages = kit.authoredBy(await kit.readMessages(channel.id), worker.id, head);
        expect(peerMessages.length, 'peer messages in the channel').toBeGreaterThan(0);
        expect(summary.content, 'coordinator summary').toContain(token);
        expect(
            Date.parse(summary.createdAt) >= Date.parse(peerReply.createdAt),
            'summary authored no earlier than the peer reply'
        ).toBe(true);
    },
});

function authoredBy(message, agentId) {
    return message.author.kind === 'agent' && message.author.agentId === agentId;
}
