// Two chats, one Agent, two different requested markers. However the Agent
// drains its queue — one turn or two — each marker must land in the chat that
// asked for it and nowhere else.

import { readChannelMessages } from '../channel-messages.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent addressed in two channels answers each one — in the channel or one of its Threads — with that channel’s marker, and never leaks the other channel’s marker across.',
    name: 'multi-chat-drain',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const tokenA = marker('CHAN-A');
        const tokenB = marker('CHAN-B');

        const channelA = await kit.createChannel({ agentIds: [worker.id] });
        const channelB = await kit.createChannel({ agentIds: [worker.id] });

        log('sending into both channels');
        await kit.harness.send(channelA.id, `@${worker.handle} reply here with exactly ${tokenA}.`);
        await kit.harness.send(channelB.id, `@${worker.handle} reply here with exactly ${tokenB}.`);

        const first = await settleTurn(worker.id);
        expect(first.status, 'first turn status').toBe('completed');
        expect(first.failureKind ?? 'none', 'first turn failure kind').toBe('none');

        let repliesA = kit.authoredBy(await readChannelMessages(kit, channelA.id), worker.id);
        let repliesB = kit.authoredBy(await readChannelMessages(kit, channelB.id), worker.id);

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
            repliesA = kit.authoredBy(await readChannelMessages(kit, channelA.id), worker.id);
            repliesB = kit.authoredBy(await readChannelMessages(kit, channelB.id), worker.id);
        }

        log('checking gates');
        expect(joined(repliesA), 'Agent answer for channel A').toContain(tokenA);
        expect(joined(repliesB), 'Agent answer for channel B').toContain(tokenB);
        const sweptA = (await readChannelMessages(kit, channelA.id))
            .map((message) => message.content)
            .join('\n');
        const sweptB = (await readChannelMessages(kit, channelB.id))
            .map((message) => message.content)
            .join('\n');
        expect(sweptA.includes(tokenB), 'channel B marker leaked into channel A').toBe(false);
        expect(sweptB.includes(tokenA), 'channel A marker leaked into channel B').toBe(false);
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
