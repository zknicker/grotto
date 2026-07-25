import { expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentRuntimeEvent } from '@tavern/api';
import type { ApiContext } from './context.ts';

const directory = mkdtempSync(join(tmpdir(), 'tavern-ws-flow-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const [{ ensureDatabaseSchema }, { applyObservedAgentRuntimeEvent }, { wsRouter }] =
    await Promise.all([
        import('../db/bootstrap.ts'),
        import('../agent-runtime/event-sync.ts'),
        import('./ws-router.ts'),
    ]);

ensureDatabaseSchema();

// Behavioral counterpart to ws-router.test.ts's registry checks: observed
// runtime events must actually flow through the websocket subscriptions with
// the durable/volatile split intact (specs/raft-alignment/README.md,
// "Transport topology (decided)"). WS6 upgrades this hop to a network
// transport with the same contracts.

test('fans a volatile composition out to every subscribed client with its payload intact', async () => {
    const caller = createCaller();
    const first = await subscribe(caller.chat.onComposition());
    const second = await subscribe(caller.chat.onComposition());
    const firstNext = first.next();
    const secondNext = second.next();
    await Bun.sleep(0);

    await applyObservedAgentRuntimeEvent(compositionEvent('cmp_fanout_1'));

    const expected = {
        agentId: 'agt_otto',
        compositionId: 'cmp_fanout_1',
        state: 'composing' as const,
        text: 'drafting a reply',
        type: 'agent.composition' as const,
    };
    expect((await firstNext).value).toMatchObject(expected);
    expect((await secondNext).value).toMatchObject(expected);

    await first.return?.(undefined);
    await second.return?.(undefined);
});

test('durable events invalidate for refetch; volatile compositions never do', async () => {
    const caller = createCaller();
    const compositions = await subscribe(caller.chat.onComposition());
    const chatUpdates = await subscribe(caller.chat.onUpdate());
    const logUpdates = await subscribe(caller.chat.log.onUpdate());
    const pendingComposition = compositions.next();
    const pendingChatUpdate = chatUpdates.next();
    const pendingLogUpdate = logUpdates.next();
    await Bun.sleep(0);

    // A volatile composition, then two durable events. Subscription yields
    // are ordered, so the first yield on each durable stream proves the
    // composition emitted nothing there.
    await applyObservedAgentRuntimeEvent(compositionEvent('cmp_quiet_1'));
    await applyObservedAgentRuntimeEvent(messageAcceptedEvent('cht_transport', 'msg_accepted_1'));
    await applyObservedAgentRuntimeEvent(historyChangedEvent('cht_transport'));

    expect((await pendingComposition).value).toMatchObject({ compositionId: 'cmp_quiet_1' });

    // First chat invalidation comes from the accepted message (broadcast,
    // no chat id), the second from the history change (chat-scoped) — the
    // composition produced neither.
    const firstChatUpdate = (await pendingChatUpdate).value as Record<string, unknown>;
    expect(firstChatUpdate.emittedAt).toEqual(expect.any(String));
    expect(firstChatUpdate.chatId).toBeUndefined();
    expect((await chatUpdates.next()).value).toMatchObject({ chatId: 'cht_transport' });

    // The chat log invalidates for both durable events and refetches from
    // canonical history — durable events replay by re-query, not by socket.
    expect((await pendingLogUpdate).value).toMatchObject({ emittedAt: expect.any(String) });
    expect((await logUpdates.next()).value).toMatchObject({ emittedAt: expect.any(String) });

    // Durable events never leak into the composition stream: the next yield
    // there is the next composition, not either durable event.
    const pendingSentinel = compositions.next();
    await applyObservedAgentRuntimeEvent(compositionEvent('cmp_sentinel_1'));
    expect((await pendingSentinel).value).toMatchObject({ compositionId: 'cmp_sentinel_1' });

    await compositions.return?.(undefined);
    await chatUpdates.return?.(undefined);
    await logUpdates.return?.(undefined);
});

async function subscribe<T>(subscription: AsyncIterable<T> | Promise<AsyncIterable<T>>) {
    return (await subscription)[Symbol.asyncIterator]();
}

function createCaller() {
    const context: ApiContext = { clerkSessionToken: null, requestHost: null };
    return wsRouter.createCaller(context);
}

function compositionEvent(compositionId: string): AgentRuntimeEvent {
    return {
        agentId: 'agt_otto',
        compositionId,
        state: 'composing',
        target: '#general',
        text: 'drafting a reply',
        timestamp: new Date().toISOString(),
        type: 'agent.composition',
    };
}

function messageAcceptedEvent(chatId: string, messageId: string): AgentRuntimeEvent {
    return {
        chatId,
        message: {
            id: messageId,
            senderId: 'usr_tavern',
            senderName: 'Zach',
            sequence: 1,
            text: 'hello there',
            timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        type: 'chat.messageAccepted',
    };
}

function historyChangedEvent(chatId: string): AgentRuntimeEvent {
    return {
        chatId,
        timestamp: new Date().toISOString(),
        type: 'chat.historyChanged',
    };
}
