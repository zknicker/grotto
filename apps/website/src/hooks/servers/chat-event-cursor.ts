import type { HostedDurableEvent } from '@tavern/api';

const pageSize = 100;

export function eventRefetchTargets(events: HostedDurableEvent[]) {
    const messageEvents = events.filter(
        (event): event is Extract<HostedDurableEvent, { type: 'message.created' }> =>
            event.type === 'message.created'
    );
    const taskEvents = events.filter(
        (event): event is Extract<HostedDurableEvent, { type: 'task.created' | 'task.updated' }> =>
            event.type === 'task.created' || event.type === 'task.updated'
    );
    const taskLabelEvents = events.filter((event) => event.type === 'task.label.updated');

    return {
        invalidateSearch: messageEvents.length > 0,
        invalidateTaskLabels: taskLabelEvents.length > 0,
        invalidateTasks: taskEvents.length > 0 || taskLabelEvents.length > 0,
        messageChatIds: [
            ...new Set(
                [...messageEvents, ...taskEvents].flatMap((event) => [
                    event.chatId,
                    ...(event.parentChatId ? [event.parentChatId] : []),
                ])
            ),
        ],
        parentChatIds: [
            ...new Set(events.flatMap((event) => (event.parentChatId ? [event.parentChatId] : []))),
        ],
    };
}

export function laterEventCursor(left: string, right: string): string {
    return BigInt(left) >= BigInt(right) ? left : right;
}

export async function walkEventCatchUp({
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
