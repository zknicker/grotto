// Two chats, one Agent, two different requested markers. However the Agent
// drains its queue — one turn or two — each marker must land in the chat that
// asked for it and nowhere else.

import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'An Agent addressed in two channels answers each one — in the channel or in a task Thread promoted from it — with that channel’s marker, and never leaks the other channel’s marker across.',
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

        log('waiting for both answers');
        // Either request may have been promoted to a task, so the answer can sit
        // in the channel or in that channel's task Thread; both satisfy it.
        const answerA = await kit.awaitAgentReply(
            channelA.id,
            worker.id,
            (message) => message.content.includes(tokenA),
            240_000
        );
        const answerB = await kit.awaitAgentReply(
            channelB.id,
            worker.id,
            (message) => message.content.includes(tokenB),
            240_000
        );

        log('checking gates');
        expect(answerA.message.content, 'answer for channel A').toContain(tokenA);
        expect(answerB.message.content, 'answer for channel B').toContain(tokenB);

        // Containment is checked over everything the channel owns — its own
        // messages plus every task Thread promoted from it.
        const sweptA = await sweepChannel(kit, channelA.id);
        const sweptB = await sweepChannel(kit, channelB.id);
        expect(sweptA.includes(tokenB), 'channel B marker leaked into channel A').toBe(false);
        expect(sweptB.includes(tokenA), 'channel A marker leaked into channel B').toBe(false);
    },
});

function joined(replies) {
    return replies.join('\n');
}

/** Every message the channel owns, its task Threads included, as one string. */
async function sweepChannel(kit, chatId) {
    const contents = (await kit.readMessages(chatId)).map((message) => message.content);
    const tasks = await kit.trpc('task.list', { serverId: kit.serverId });
    for (const entry of tasks.filter((item) => item.task.chatId === chatId)) {
        await kit.trackChat(entry.task.threadChatId);
        const thread = await kit.readMessages(entry.task.threadChatId);
        contents.push(...thread.map((message) => message.content));
    }
    return contents.join('\n');
}

/** A drained queue starts no second turn; that is a pass, not an error. */
function toleratedIdle(error) {
    if (String(error).includes('no turn started')) {
        return null;
    }
    throw error;
}
