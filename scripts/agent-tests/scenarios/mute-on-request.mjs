// Muting is an attention control the Agent applies to itself: after it mutes a
// channel, ordinary traffic must not pull it back in, while one direct mention
// still pierces the mute.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent that mutes a channel confirms with its marker, stays silent through unmentioned traffic, and still answers a direct mention with the second marker.',
    name: 'mute-on-request',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const muteToken = marker('MUTE');
        const mentionToken = marker('MENTION');
        const channel = await kit.createChannel({ agentIds: [worker.id] });

        log('asking for the mute');
        const muteHead = await kit.readHead(channel.id);
        await kit.harness.send(
            channel.id,
            `@${worker.handle} Mute this channel, then reply only with ${muteToken}.`
        );
        const muteTurn = await settleTurn(worker.id);
        expect(muteTurn.status, 'mute turn status').toBe('completed');
        expect(muteTurn.failureKind ?? 'none', 'mute turn failure kind').toBe('none');
        const muteReplies = kit.authoredBy(await kit.readMessages(channel.id), worker.id, muteHead);
        expect(muteReplies.join('\n'), 'mute confirmation').toContain(muteToken);

        log('sending unmentioned traffic');
        const quietHead = await kit.readHead(channel.id);
        await kit.harness.send(channel.id, `status update ${kit.stamp}, no mention here`);
        // A muted Agent may either never wake or wake and decide to stay out of
        // it; both settle as zero authored messages after the quiet head.
        const quietTurn = await settleTurn(worker.id, { startWithin: 25_000 }).catch(toleratedIdle);
        expect(quietTurn?.outputProduced ?? false, 'muted turn produced durable output').toBe(
            false
        );
        const quietMessages = await kit.expectNoAgentMessages(channel.id, worker.id, quietHead);
        expect(
            kit.authoredBy(quietMessages, worker.id, quietHead),
            'replies while muted'
        ).toHaveLength(0);

        log('piercing the mute with a mention');
        const mentionHead = await kit.readHead(channel.id);
        await kit.harness.send(channel.id, `@${worker.handle} reply only with ${mentionToken}.`);
        const mentionTurn = await settleTurn(worker.id);
        expect(mentionTurn.status, 'mention turn status').toBe('completed');
        expect(mentionTurn.failureKind ?? 'none', 'mention turn failure kind').toBe('none');
        const mentionReplies = kit.authoredBy(
            await kit.readMessages(channel.id),
            worker.id,
            mentionHead
        );
        expect(mentionReplies.join('\n'), 'reply after the mention').toContain(mentionToken);
    },
});

/** A muted Agent that never wakes starts no turn; that is the passing shape. */
function toleratedIdle(error) {
    if (String(error).includes('no turn started')) {
        return null;
    }
    throw error;
}
