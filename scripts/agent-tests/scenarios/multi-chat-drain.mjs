// Two chats, one Agent, two different requested markers. However the Agent
// drains its queue — one turn or two — each marker must land in the chat that
// asked for it and nowhere else.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent addressed in two channels answers each channel with that channel’s marker and never leaks the other channel’s marker across.',
    name: 'multi-chat-drain',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const tokenA = marker('CHAN-A');
        const tokenB = marker('CHAN-B');

        const channelA = await kit.createChannel({ agentIds: [worker.id] });
        const channelB = await kit.createChannel({ agentIds: [worker.id] });
        const headA = await kit.readHead(channelA.id);
        const headB = await kit.readHead(channelB.id);

        log('sending into both channels');
        await kit.harness.send(channelA.id, `@${worker.handle} reply here with exactly ${tokenA}.`);
        await kit.harness.send(channelB.id, `@${worker.handle} reply here with exactly ${tokenB}.`);

        const first = await settleTurn(worker.id);
        expect(first.status, 'first turn status').toBe('completed');
        expect(first.failureKind ?? 'none', 'first turn failure kind').toBe('none');

        let repliesA = kit.authoredBy(await kit.readMessages(channelA.id), worker.id, headA);
        let repliesB = kit.authoredBy(await kit.readMessages(channelB.id), worker.id, headB);

        // The Agent may drain both chats in one turn or take a second turn for
        // the queued one; only the second turn is optional, so a missing reply
        // fails on the marker gates below rather than on the settle.
        if (!(joined(repliesA).includes(tokenA) && joined(repliesB).includes(tokenB))) {
            log('waiting for the second drain turn');
            const second = await settleTurn(worker.id, { startWithin: 30_000 }).catch(
                toleratedIdle
            );
            if (second) {
                expect(second.status, 'second turn status').toBe('completed');
            }
            repliesA = kit.authoredBy(await kit.readMessages(channelA.id), worker.id, headA);
            repliesB = kit.authoredBy(await kit.readMessages(channelB.id), worker.id, headB);
        }

        log('checking gates');
        expect(joined(repliesA), 'replies in channel A').toContain(tokenA);
        expect(joined(repliesB), 'replies in channel B').toContain(tokenB);
        expect(joined(repliesA).includes(tokenB), 'channel B marker leaked into channel A').toBe(
            false
        );
        expect(joined(repliesB).includes(tokenA), 'channel A marker leaked into channel B').toBe(
            false
        );
    },
});

function joined(replies) {
    return replies.join('\n');
}

/** A drained queue starts no second turn; that is a pass, not an error. */
function toleratedIdle(error) {
    if (String(error).includes('no turn started')) {
        return null;
    }
    throw error;
}
