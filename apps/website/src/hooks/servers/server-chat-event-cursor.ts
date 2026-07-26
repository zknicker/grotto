import type { HostedDurableEvent } from '@tavern/api';

const pageSize = 100;

export function laterHostedEventCursor(left: string, right: string): string {
    return BigInt(left) >= BigInt(right) ? left : right;
}

export async function walkHostedEventCatchUp({
    afterCursor,
    fetchPage,
    onEvents,
}: {
    afterCursor: string;
    fetchPage: (afterCursor: string, limit: number) => Promise<HostedDurableEvent[]>;
    onEvents: (events: HostedDurableEvent[]) => Promise<void>;
}): Promise<string> {
    let walkCursor = afterCursor;
    let events: HostedDurableEvent[];

    do {
        events = await fetchPage(walkCursor, pageSize);
        await onEvents(events);
        walkCursor = events.at(-1)?.cursor ?? walkCursor;
    } while (events.length === pageSize);

    return walkCursor;
}
