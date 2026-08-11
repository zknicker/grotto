import type { ChatEventOf } from './chat-event-registry.ts';

/** Durable event builders shared by the Chat event listener tests. */
export function messageEvent(
    cursor: string,
    chatId: string,
    parentChatId: string | null = null
): ChatEventOf<'message.created'> {
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

export function readEvent(cursor: string, chatId: string): ChatEventOf<'chat.read'> {
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

export function lifecycleEvent(
    cursor: string,
    chatId: string,
    action: 'archived' | 'created' | 'deleted' | 'unarchived' | 'updated'
): ChatEventOf<'chat.lifecycle'> {
    return {
        action,
        chatId,
        createdAt: '2026-08-10T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        parentChatId: null,
        sequence: 0,
        serverId: 'server_one',
        type: 'chat.lifecycle',
    };
}

export function threadFollowEvent(
    cursor: string,
    chatId: string,
    parentChatId: string
): ChatEventOf<'thread.follow.updated'> {
    return {
        chatId,
        createdAt: '2026-07-26T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        parentChatId,
        sequence: Number(cursor),
        serverId: 'server_one',
        type: 'thread.follow.updated',
    };
}

export function taskEvent(
    cursor: string,
    chatId: string,
    type: 'task.created' | 'task.updated' = 'task.updated'
): ChatEventOf<'task.created' | 'task.updated'> {
    return {
        chatId,
        createdAt: '2026-07-26T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        messageId: `message_${cursor}`,
        parentChatId: null,
        sequence: Number(cursor),
        serverId: 'server_one',
        type,
    };
}

export function taskLabelEvent(cursor: string, labelId: string): ChatEventOf<'task.label.updated'> {
    return {
        chatId: null,
        createdAt: '2026-07-26T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        labelId,
        parentChatId: null,
        sequence: 0,
        serverId: 'server_one',
        type: 'task.label.updated',
    };
}

export function reminderEvent(cursor: string, chatId: string): ChatEventOf<'reminder.changed'> {
    return {
        action: 'scheduled',
        chatId,
        createdAt: '2026-08-10T12:00:00.000Z',
        cursor,
        id: `event_${cursor}`,
        parentChatId: null,
        reminderId: `rem_${cursor}`,
        sequence: 0,
        serverId: 'server_one',
        type: 'reminder.changed',
    };
}
