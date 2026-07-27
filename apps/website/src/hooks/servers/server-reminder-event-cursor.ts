import type { HostedReminderChangedEvent } from '@tavern/api';

const pageSize = 100;

export function laterReminderCursor(left: string, right: string) {
    return BigInt(left) >= BigInt(right) ? left : right;
}

export async function walkReminderChangeCatchUp({
    afterCursor,
    fetchPage,
    onEvents,
}: {
    afterCursor: string;
    fetchPage: (afterCursor: string, limit: number) => Promise<HostedReminderChangedEvent[]>;
    onEvents: (events: HostedReminderChangedEvent[]) => Promise<void>;
}) {
    let cursor = afterCursor;
    let events: HostedReminderChangedEvent[];
    do {
        events = await fetchPage(cursor, pageSize);
        await onEvents(events);
        cursor = events.at(-1)?.cursor ?? cursor;
    } while (events.length === pageSize);
    return cursor;
}
