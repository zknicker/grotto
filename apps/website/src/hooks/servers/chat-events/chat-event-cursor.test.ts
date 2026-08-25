import { expect, test } from 'bun:test';
import type { ServerDurableEvent } from '@grotto/api';
import { createChatEventBatch, laterEventCursor, walkEventCatchUp } from './chat-event-cursor.ts';
import { lifecycleEvent, messageEvent, readEvent } from './chat-event-fixtures.ts';

test('catch-up keeps a private cursor while a newer live event advances shared state', async () => {
    const firstFetch = Promise.withResolvers<ServerDurableEvent[]>();
    const fetchedAfter: string[] = [];
    const passes: ServerDurableEvent[][] = [];
    let sharedCursor = '1';
    let fetchCount = 0;

    const catchUp = walkEventCatchUp({
        afterCursor: sharedCursor,
        fetchPage: async (afterCursor) => {
            fetchedAfter.push(afterCursor);
            fetchCount += 1;
            return fetchCount === 1 ? await firstFetch.promise : [];
        },
        onEvents: async (events) => {
            passes.push(events);
        },
    });

    sharedCursor = laterEventCursor(sharedCursor, '4');
    firstFetch.resolve([messageEvent('2', 'chat_two'), messageEvent('3', 'chat_three')]);
    const walkedCursor = await catchUp;
    sharedCursor = laterEventCursor(sharedCursor, walkedCursor);

    expect(fetchedAfter).toEqual(['1']);
    expect(passes).toHaveLength(1);
    expect(passes[0]?.map((event) => event.cursor)).toEqual(['2', '3']);
    expect(sharedCursor).toBe('4');
});

test('a multi-page catch-up coalesces every page into one dispatch pass', async () => {
    const fetchedAfter: string[] = [];
    const passes: ServerDurableEvent[][] = [];
    const fullPage = Array.from({ length: 100 }, (_, index) =>
        messageEvent(String(index + 1), `chat_${index % 2}`)
    );

    const walkedCursor = await walkEventCatchUp({
        afterCursor: '0',
        fetchPage: async (afterCursor) => {
            fetchedAfter.push(afterCursor);
            return afterCursor === '0' ? fullPage : [readEvent('101', 'chat_read')];
        },
        onEvents: async (events) => {
            passes.push(events);
        },
    });

    expect(fetchedAfter).toEqual(['0', '100']);
    expect(passes).toHaveLength(1);
    expect(passes[0]).toHaveLength(101);
    expect(passes[0]?.at(-1)?.type).toBe('chat.read');
    expect(walkedCursor).toBe('101');
});

test('an empty catch-up walk dispatches nothing', async () => {
    let passes = 0;

    const walkedCursor = await walkEventCatchUp({
        afterCursor: '7',
        fetchPage: async () => [],
        onEvents: async () => {
            passes += 1;
        },
    });

    expect(passes).toBe(0);
    expect(walkedCursor).toBe('7');
});

test('a batch drains its whole burst in arrival order', () => {
    const batch = createChatEventBatch();

    expect(batch.add(messageEvent('2', 'chat_one'))).toBe(true);
    expect(batch.add(readEvent('3', 'chat_one'))).toBe(false);
    expect(batch.add(lifecycleEvent('4', 'chat_two', 'created'))).toBe(false);

    expect(batch.drain()?.map((event) => event.cursor)).toEqual(['2', '3', '4']);
});

test('a drained batch opens a fresh window and an empty batch drains nothing', () => {
    const batch = createChatEventBatch();

    expect(batch.drain()).toBeNull();
    batch.add(messageEvent('2', 'chat_one'));
    batch.drain();

    expect(batch.drain()).toBeNull();
    expect(batch.add(readEvent('3', 'chat_two'))).toBe(true);
    expect(batch.drain()?.map((event) => event.cursor)).toEqual(['3']);
});

test('the later cursor wins in both directions', () => {
    expect(laterEventCursor('9', '10')).toBe('10');
    expect(laterEventCursor('10', '9')).toBe('10');
});
