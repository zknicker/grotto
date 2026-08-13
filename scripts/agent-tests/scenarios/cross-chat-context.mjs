// One session spans every chat an Agent participates in: a fact the Owner gives
// in the standing Owner DM must still be available when the same Agent is asked
// about it in a Channel, without the Owner restating it.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent told a codename in its Owner DM answers a later Channel question inline with that codename, so context carries across chats inside one session.',
    name: 'cross-chat-context',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const codename = marker('CODENAME');

        // The Owner DM is standing collaboration: read its head, never track it,
        // so cleanup only ever deletes the channel this scenario created.
        const dm = worker.dmChatId;
        if (!dm) {
            throw new Error(`@${worker.handle} has no standing Owner DM to carry context from.`);
        }
        const dmHead = await kit.readHead(dm);

        log('seeding the DM');
        await kit.harness.send(
            dm,
            `For this exercise, remember the deployment codename is ${codename}. Confirm briefly.`
        );

        const dmTurn = await settleTurn(worker.id);
        expect(dmTurn.status, 'DM turn status').toBe('completed');
        expect(dmTurn.failureKind ?? 'none', 'DM turn failure kind').toBe('none');
        expect(dmTurn.outputProduced, 'DM turn produced durable output').toBe(true);

        const dmReplies = kit.authoredBy(await kit.readMessages(dm), worker.id, dmHead);
        expect(dmReplies.length, 'DM replies confirming the codename').toBeGreaterThan(0);

        log('asking in a channel');
        const channel = await kit.createChannel({ agentIds: [worker.id] });
        const channelHead = await kit.readHead(channel.id);
        await kit.harness.send(
            channel.id,
            `@${worker.handle} What deployment codename did I give you in DM? Reply with just the codename, inline, no task.`
        );

        const channelTurn = await settleTurn(worker.id);
        expect(channelTurn.status, 'channel turn status').toBe('completed');
        expect(channelTurn.failureKind ?? 'none', 'channel turn failure kind').toBe('none');
        expect(channelTurn.outputProduced, 'channel turn produced durable output').toBe(true);

        log('checking gates');
        const channelReplies = kit.authoredBy(
            await kit.readMessages(channel.id),
            worker.id,
            channelHead
        );
        expect(channelReplies.length, 'inline replies in the channel').toBeGreaterThan(0);
        expect(channelReplies, 'channel reply carrying the DM codename').toContain(codename);
    },
});
