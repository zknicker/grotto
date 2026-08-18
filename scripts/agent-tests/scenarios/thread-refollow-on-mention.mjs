// A direct Thread mention reverses an explicit Agent unfollow. The scenario proves both sides of
// the transition: ordinary work is absent while unfollowed, then resumes after the mention.

import { threadTarget } from '../author.mjs';
import { defineScenario } from '../scenario.mjs';

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'After an Agent explicitly unfollows a Thread, ordinary work is suppressed until a direct mention restores the follow; later ordinary Thread work is then delivered again.',
    name: 'thread-refollow-on-mention',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const firstToken = marker('UNFOLLOW');
        const restoredToken = marker('RESTORED');
        const ordinaryToken = marker('ORDINARY');

        const channel = await kit.createChannel({ agentIds: [worker.id] });
        const anchor = await send(kit, channel.id, `Thread re-follow anchor ${kit.stamp}`);
        const target = threadTarget(channel.name, anchor.message.id);

        log('asking the Agent to unfollow');
        const initial = await kit.sendInThread(
            channel.id,
            anchor.message.id,
            `@${worker.handle} Reply with exactly ${firstToken}. Then run grotto thread unfollow --target "${target}" before finishing. Do not send any other message.`
        );
        const threadChatId = initial.threadChatId;
        expect(threadChatId, 'Thread chat id').toBeTruthy();

        const firstTurn = await settleTurn(worker.id);
        expect(firstTurn.status, 'unfollow turn status').toBe('completed');
        expect(firstTurn.failureKind ?? 'none', 'unfollow turn failure kind').toBe('none');
        expect(
            kit.authoredBy(await kit.readMessages(threadChatId), worker.id),
            'initial Thread reply'
        ).toContain(firstToken);

        log('proving ordinary work is suppressed while unfollowed');
        const suppressed = await kit.sendInThread(
            channel.id,
            anchor.message.id,
            `Ordinary unmentioned Thread message ${marker('SUPPRESSED')}.`
        );
        const deliveries = await kit.turns.listDeliveries(worker.id);
        expect(deliveries, 'Agent delivery observability').toBeTruthy();
        expect(
            deliveries?.some((row) => row.messageId === suppressed.message.id) ?? false,
            'suppressed message entered Agent delivery'
        ).toBe(false);

        log('mentioning the Agent back into the Thread');
        const restoreHead = await kit.readHead(threadChatId);
        await kit.sendInThread(
            channel.id,
            anchor.message.id,
            `@${worker.handle} Reply with exactly ${restoredToken}.`
        );
        const restoreTurn = await settleTurn(worker.id);
        expect(restoreTurn.status, 'restoration turn status').toBe('completed');
        expect(restoreTurn.failureKind ?? 'none', 'restoration turn failure kind').toBe('none');
        expect(
            kit.authoredBy(await kit.readMessages(threadChatId), worker.id, restoreHead),
            'reply after direct mention restored the follow'
        ).toContain(restoredToken);

        log('proving later ordinary Thread work is delivered');
        const ordinaryHead = await kit.readHead(threadChatId);
        await kit.sendInThread(
            channel.id,
            anchor.message.id,
            `Reply with exactly ${ordinaryToken}.`
        );
        const ordinaryTurn = await settleTurn(worker.id);
        expect(ordinaryTurn.status, 'ordinary follow turn status').toBe('completed');
        expect(ordinaryTurn.failureKind ?? 'none', 'ordinary follow turn failure kind').toBe(
            'none'
        );
        expect(
            kit.authoredBy(await kit.readMessages(threadChatId), worker.id, ordinaryHead),
            'ordinary reply after follow restoration'
        ).toContain(ordinaryToken);
    },
});

function send(kit, chatId, content) {
    return kit.trpc('chat.send', {
        attachmentIds: [],
        chatId,
        content,
        nonce: `agenttests_${kit.stamp}_${crypto.randomUUID()}`,
        serverId: kit.serverId,
    });
}
