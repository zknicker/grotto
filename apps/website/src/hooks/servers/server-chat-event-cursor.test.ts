import { expect, test } from 'bun:test';
import type { HostedDurableEvent } from '@tavern/api';
import {
    hostedEventRefetchTargets,
    laterHostedEventCursor,
    walkHostedEventCatchUp,
} from './server-chat-event-cursor.ts';

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
            refetched.push(
                ...events.flatMap((event) => (event.chatId === null ? [] : [event.chatId]))
            );
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

test('read and follow events refetch only their parent summaries', () => {
    expect(
        hostedEventRefetchTargets([
            {
                chatId: 'thread_one',
                createdAt: '2026-07-26T12:00:00.000Z',
                cursor: '2',
                id: 'event_2',
                parentChatId: 'chat_parent',
                sequence: 1,
                serverId: 'server_one',
                type: 'thread.follow.updated',
            },
        ])
    ).toEqual({
        invalidateSearch: false,
        invalidateTaskLabels: false,
        invalidateTasks: false,
        messageChatIds: [],
        parentChatIds: ['chat_parent'],
    });
});

test('task events refetch the task list and only the affected message chat', () => {
    expect(
        hostedEventRefetchTargets([
            {
                chatId: 'chat_one',
                createdAt: '2026-07-26T12:00:00.000Z',
                cursor: '3',
                id: 'event_3',
                messageId: 'message_3',
                parentChatId: null,
                sequence: 8,
                serverId: 'server_one',
                type: 'task.updated',
            },
        ])
    ).toEqual({
        invalidateSearch: false,
        invalidateTaskLabels: false,
        invalidateTasks: true,
        messageChatIds: ['chat_one'],
        parentChatIds: [],
    });
});

test('task label events refetch the task catalog and task list without chat snapshots', () => {
    expect(
        hostedEventRefetchTargets([
            {
                chatId: null,
                createdAt: '2026-07-26T12:00:00.000Z',
                cursor: '4',
                id: 'event_4',
                labelId: 'label_one',
                parentChatId: null,
                sequence: 0,
                serverId: 'server_one',
                type: 'task.label.updated',
            },
        ])
    ).toEqual({
        invalidateSearch: false,
        invalidateTaskLabels: true,
        invalidateTasks: true,
        messageChatIds: [],
        parentChatIds: [],
    });
});

function messageEvent(cursor: string, chatId: string): HostedDurableEvent {
    return {
        chatId,
        createdAt: '2026-07-26T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        messageId: `message_${cursor}`,
        parentChatId: null,
        sequence: Number(cursor),
        serverId: 'server_one',
        type: 'message.created',
    };
}
