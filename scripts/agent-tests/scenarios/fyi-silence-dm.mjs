// The same no-response contract in the Agent's standing Owner DM, where every
// message is addressed by definition. The DM is durable collaboration the pool
// Agent keeps between runs, so this scenario anchors on its head and never
// tracks or deletes it.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'A DM that explicitly requires no response wakes a turn that settles with no durable output and leaves the Owner DM unchanged after its head.',
    name: 'fyi-silence-dm',
    async run({ agents, expect, kit, log }) {
        const [worker] = agents;
        const dmChatId = worker.dmChatId;
        if (!dmChatId) {
            throw new Error(`Pool Agent @${worker.handle} has no Owner DM to send into.`);
        }

        const head = await kit.readHead(dmChatId);
        log('sending the FYI');
        await kit.harness.send(
            dmChatId,
            `FYI only, no response needed: deploy ${kit.stamp} finished cleanly.`
        );

        log('waiting for a silent turn');
        const turn = await kit.assertSilence(worker.id, dmChatId, { sinceSequence: head });
        expect(turn.status, 'turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'turn failure kind').toBe('none');
        expect(turn.outputProduced, 'turn produced durable output').toBe(false);
        expect(turn.messageCount, 'durable messages in the turn').toBe(0);

        const messages = await kit.readMessages(dmChatId);
        expect(kit.authoredBy(messages, worker.id, head), 'replies in the Owner DM').toHaveLength(
            0
        );
    },
});
