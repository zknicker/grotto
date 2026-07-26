import { expect, test } from 'bun:test';
import type { HostedDurableEvent } from '@tavern/api';
import { laterHostedEventCursor, walkHostedEventCatchUp } from './server-chat-event-cursor.ts';

test('catch-up keeps a private cursor while a newer live event advances shared state', async () => {
    const firstFetch = Promise.withResolvers<HostedDurableEvent[]>();
    const fetchedAfter: string[] = [];
    const refetched: string[] = [];
    let sharedCursor = '1';
    let fetchCount = 0;

    const catchUp = walkHostedEventCatchUp({
        afterCursor: sharedCursor,
        fetchPage: async (afterCursor) => {
            fetchedAfter.push(afterCursor);
            fetchCount += 1;
            return fetchCount === 1 ? await firstFetch.promise : [];
        },
        onEvents: async (events) => {
            refetched.push(...events.map((event) => event.chatId));
        },
    });

    sharedCursor = laterHostedEventCursor(sharedCursor, '4');
    firstFetch.resolve([messageEvent('2', 'chat_two'), messageEvent('3', 'chat_three')]);
    const walkedCursor = await catchUp;
    sharedCursor = laterHostedEventCursor(sharedCursor, walkedCursor);

    expect(fetchedAfter).toEqual(['1']);
    expect(refetched).toEqual(['chat_two', 'chat_three']);
    expect(sharedCursor).toBe('4');
});

function messageEvent(cursor: string, chatId: string): HostedDurableEvent {
    return {
        chatId,
        createdAt: '2026-07-26T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        messageId: `message_${cursor}`,
        sequence: Number(cursor),
        serverId: 'server_one',
        type: 'message.created',
    };
}
