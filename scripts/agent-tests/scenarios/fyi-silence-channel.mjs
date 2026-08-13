// A channel FYI that explicitly asks for no response still wakes the mentioned
// Agent — the turn must run and settle without authoring anything.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'A mention that explicitly requires no response wakes a turn that settles with no durable output, no channel message, and a seen delivery.',
    name: 'fyi-silence-channel',
    async run({ agents, expect, kit, log }) {
        const [worker] = agents;

        const channel = await kit.createChannel({ agentIds: [worker.id] });
        const head = await kit.readHead(channel.id);
        log('sending the FYI');

        await kit.harness.send(
            channel.id,
            `@${worker.handle} FYI only, no response needed: deploy ${kit.stamp} finished cleanly.`
        );

        log('waiting for a silent turn');
        const turn = await kit.assertSilence(worker.id, channel.id, { sinceSequence: head });
        expect(turn.status, 'turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'turn failure kind').toBe('none');
        expect(turn.outputProduced, 'turn produced durable output').toBe(false);
        expect(turn.messageCount, 'durable messages in the turn').toBe(0);

        const messages = await kit.readMessages(channel.id);
        expect(kit.authoredBy(messages, worker.id, head), 'replies in the channel').toHaveLength(0);
    },
});
