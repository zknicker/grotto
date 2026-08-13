import type { ServerDurableEvent } from '@tavern/api';

const pageSize = 100;

/**
 * How long one live-event burst is collected before it dispatches. A busy Chat
 * delivers a message, its read, and its Thread follow within a few frames; one
 * dispatch pass per window keeps that from costing three refetch fan-outs.
 */
export const chatEventBatchWindowMs = 150;

export interface ChatEventBatch {
    /** Collects one event. Returns true when it opened a new window. */
    add: (event: ServerDurableEvent) => boolean;
    /** Empties the window into its collected events, or null when nothing waits. */
    drain: () => ServerDurableEvent[] | null;
}

/**
 * The window's collected events, kept outside React so the timer and the
 * subscription share one buffer without re-rendering. Cursor advancement stays
 * with the caller: it is immediate and exact regardless of batching.
 */
export function createChatEventBatch(): ChatEventBatch {
    let pending: ServerDurableEvent[] = [];

    return {
        add: (event) => {
            const opensWindow = pending.length === 0;
            pending.push(event);
            return opensWindow;
        },
        drain: () => {
            if (pending.length === 0) {
                return null;
            }
            const events = pending;
            pending = [];
            return events;
        },
    };
}

export function laterEventCursor(left: string, right: string): string {
    return BigInt(left) >= BigInt(right) ? left : right;
}

/**
 * Walks every durable event newer than `afterCursor` and reports them in one
 * dispatch pass after the walk, so a long reconnect gap costs a single refetch
 * fan-out. The accumulated events are bounded by that reconnect gap.
 */
export async function walkEventCatchUp({
    afterCursor,
    fetchPage,
    onEvents,
}: {
    afterCursor: string;
    fetchPage: (afterCursor: string, limit: number) => Promise<ServerDurableEvent[]>;
    onEvents: (events: ServerDurableEvent[]) => Promise<void>;
}): Promise<string> {
    let walkCursor = afterCursor;
    const walked: ServerDurableEvent[] = [];
    let events: ServerDurableEvent[];

    do {
        events = await fetchPage(walkCursor, pageSize);
        walked.push(...events);
        walkCursor = events.at(-1)?.cursor ?? walkCursor;
    } while (events.length === pageSize);

    if (walked.length > 0) {
        await onEvents(walked);
    }

    return walkCursor;
}
