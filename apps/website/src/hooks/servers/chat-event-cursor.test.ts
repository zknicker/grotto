import { expect, test } from 'bun:test';
import type { HostedDurableEvent } from '@tavern/api';
import {
    type ChatEventTargets,
    emptyChatEventTargets,
    eventRefetchTargets,
    laterEventCursor,
    mergeChatEventTargets,
    walkEventCatchUp,
} from './chat-event-cursor.ts';

test('catch-up keeps a private cursor while a newer live event advances shared state', async () => {
    const firstFetch = Promise.withResolvers<HostedDurableEvent[]>();
    const fetchedAfter: string[] = [];
    const passes: ChatEventTargets[] = [];
    let sharedCursor = '1';
    let fetchCount = 0;

    const catchUp = walkEventCatchUp({
        afterCursor: sharedCursor,
        fetchPage: async (afterCursor) => {
            fetchedAfter.push(afterCursor);
            fetchCount += 1;
            return fetchCount === 1 ? await firstFetch.promise : [];
        },
        onTargets: async (targets) => {
            passes.push(targets);
        },
    });

    sharedCursor = laterEventCursor(sharedCursor, '4');
    firstFetch.resolve([messageEvent('2', 'chat_two'), messageEvent('3', 'chat_three')]);
    const walkedCursor = await catchUp;
    sharedCursor = laterEventCursor(sharedCursor, walkedCursor);

    expect(fetchedAfter).toEqual(['1']);
    expect(passes).toHaveLength(1);
    expect(passes[0]?.messageChatIds).toEqual(['chat_two', 'chat_three']);
    expect(sharedCursor).toBe('4');
});

test('a multi-page catch-up coalesces every page into one invalidation pass', async () => {
    const fetchedAfter: string[] = [];
    const passes: ChatEventTargets[] = [];
    const fullPage = Array.from({ length: 100 }, (_, index) =>
        messageEvent(String(index + 1), `chat_${index % 2}`)
    );

    const walkedCursor = await walkEventCatchUp({
        afterCursor: '0',
        fetchPage: async (afterCursor) => {
            fetchedAfter.push(afterCursor);
            return afterCursor === '0' ? fullPage : [readEvent('101', 'chat_read')];
        },
        onTargets: async (targets) => {
            passes.push(targets);
        },
    });

    expect(fetchedAfter).toEqual(['0', '100']);
    expect(passes).toHaveLength(1);
    expect(passes[0]?.messageChatIds).toEqual(['chat_0', 'chat_1']);
    expect(passes[0]?.invalidateChatList).toBe(true);
    expect(walkedCursor).toBe('101');
});

test('an empty catch-up walk invalidates nothing', async () => {
    let passes = 0;

    const walkedCursor = await walkEventCatchUp({
        afterCursor: '7',
        fetchPage: async () => [],
        onTargets: async () => {
            passes += 1;
        },
    });

    expect(passes).toBe(0);
    expect(walkedCursor).toBe('7');
});

test('message events refetch the chat list, search, and both transcript reads', () => {
    expect(eventRefetchTargets([messageEvent('2', 'chat_thread', 'chat_parent')])).toEqual({
        invalidateChatList: true,
        invalidateReminders: false,
        invalidateSearch: true,
        invalidateTaskLabels: false,
        invalidateTasks: false,
        lifecycleChatIds: [],
        messageChatIds: ['chat_thread', 'chat_parent'],
        threadMessageChatIds: ['chat_thread'],
    });
});

test('read events refetch only the chat list', () => {
    expect(eventRefetchTargets([readEvent('3', 'chat_one')])).toEqual({
        ...emptyChatEventTargets(),
        invalidateChatList: true,
    });
});

test('follow events refetch the chat list and the parent transcript', () => {
    expect(
        eventRefetchTargets([
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
        ...emptyChatEventTargets(),
        invalidateChatList: true,
        messageChatIds: ['chat_parent'],
    });
});

test('task events refetch the task list and the affected transcript without the chat list', () => {
    expect(
        eventRefetchTargets([
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
        ...emptyChatEventTargets(),
        invalidateTasks: true,
        messageChatIds: ['chat_one'],
        threadMessageChatIds: ['chat_one'],
    });
});

test('task label events refetch the task catalog and task list only', () => {
    expect(
        eventRefetchTargets([
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
        ...emptyChatEventTargets(),
        invalidateTaskLabels: true,
        invalidateTasks: true,
    });
});

test('reminder events refetch reminder state without the chat list', () => {
    expect(
        eventRefetchTargets([
            {
                action: 'scheduled',
                chatId: 'chat_one',
                createdAt: '2026-08-10T12:00:00.000Z',
                cursor: '6',
                id: 'event_6',
                parentChatId: null,
                reminderId: 'rem_one',
                sequence: 0,
                serverId: 'server_one',
                type: 'reminder.changed',
            },
        ])
    ).toEqual({ ...emptyChatEventTargets(), invalidateReminders: true });
});

test('channel lifecycle events target the changed channel snapshot and the chat list', () => {
    expect(
        eventRefetchTargets([
            {
                action: 'archived',
                chatId: 'chat_one',
                createdAt: '2026-08-10T12:00:00.000Z',
                cursor: '5',
                id: 'event_5',
                parentChatId: null,
                sequence: 0,
                serverId: 'server_one',
                type: 'chat.lifecycle',
            },
        ])
    ).toEqual({
        ...emptyChatEventTargets(),
        invalidateChatList: true,
        lifecycleChatIds: ['chat_one'],
    });
});

test('merging targets unions flags and dedupes chat ids', () => {
    expect(
        mergeChatEventTargets(
            eventRefetchTargets([messageEvent('2', 'chat_one')]),
            eventRefetchTargets([messageEvent('3', 'chat_one'), readEvent('4', 'chat_two')])
        )
    ).toEqual({
        ...emptyChatEventTargets(),
        invalidateChatList: true,
        invalidateSearch: true,
        messageChatIds: ['chat_one'],
        threadMessageChatIds: ['chat_one'],
    });
});

function messageEvent(
    cursor: string,
    chatId: string,
    parentChatId: string | null = null
): HostedDurableEvent {
    return {
        chatId,
        createdAt: '2026-07-26T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        messageId: `message_${cursor}`,
        parentChatId,
        sequence: Number(cursor),
        serverId: 'server_one',
        type: 'message.created',
    };
}

function readEvent(cursor: string, chatId: string): HostedDurableEvent {
    return {
        chatId,
        createdAt: '2026-07-26T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        parentChatId: null,
        sequence: Number(cursor),
        serverId: 'server_one',
        type: 'chat.read',
    };
}
