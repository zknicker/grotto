import { expect, test } from 'bun:test';
import type { HostedReminderChangedEvent } from '@tavern/api';
import {
    catchUpReminderChanges,
    laterReminderCursor,
    walkReminderChangeCatchUp,
} from './server-reminder-event-cursor.ts';

test('initial reminder catch-up reads the durable head and refreshes once', async () => {
    const calls: string[] = [];
    const cursor = await catchUpReminderChanges({
        afterCursor: '0',
        fetchHead: async () => {
            calls.push('head');
            return '41';
        },
        fetchPage: async () => {
            throw new Error('Initial catch-up must not walk reminder history.');
        },
        onEvents: async () => {
            throw new Error('Initial catch-up must not replay reminder history.');
        },
        onSnapshot: async () => {
            calls.push('snapshot');
        },
    });

    expect(cursor).toBe('41');
    expect(calls).toEqual(['head', 'snapshot']);
});

test('reconnect catch-up never moves behind a newer live reminder event', async () => {
    const firstFetch = Promise.withResolvers<HostedReminderChangedEvent[]>();
    let sharedCursor = '1';
    const invalidated: string[] = [];
    const catchUp = walkReminderChangeCatchUp({
        afterCursor: sharedCursor,
        fetchPage: async () => await firstFetch.promise,
        onEvents: async (events) => {
            invalidated.push(...events.map((event) => event.reminderId));
        },
    });

    sharedCursor = laterReminderCursor(sharedCursor, '4');
    firstFetch.resolve([reminderEvent('2'), reminderEvent('3')]);
    sharedCursor = laterReminderCursor(sharedCursor, await catchUp);

    expect(invalidated).toEqual(['rem_2', 'rem_3']);
    expect(sharedCursor).toBe('4');
});

function reminderEvent(cursor: string): HostedReminderChangedEvent {
    return {
        action: 'updated',
        chatId: 'cht_all',
        createdAt: '2026-07-26T12:00:00.000Z',
        cursor,
        id: `evt_${cursor}`,
        parentChatId: null,
        reminderId: `rem_${cursor}`,
        sequence: Number(cursor),
        serverId: 'srv_one',
        type: 'reminder.changed',
    };
}
