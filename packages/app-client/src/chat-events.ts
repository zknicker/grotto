import type { ServerDurableEvent } from '@tavern/api';

const eventPageSize = 100;

export const chatEventBatchWindowMs = 150;

export interface ChatEventBatch {
    add: (event: ServerDurableEvent) => boolean;
    drain: () => ServerDurableEvent[] | null;
}

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
        events = await fetchPage(walkCursor, eventPageSize);
        walked.push(...events);
        walkCursor = events.at(-1)?.cursor ?? walkCursor;
    } while (events.length === eventPageSize);

    if (walked.length > 0) {
        await onEvents(walked);
    }

    return walkCursor;
}

export type ChatEventType = ServerDurableEvent['type'];
export type ChatEventOf<Type extends ChatEventType> = Extract<ServerDurableEvent, { type: Type }>;
export type ChatEventHandler<Type extends ChatEventType> = (
    events: ChatEventOf<Type>[],
    serverId: string
) => Promise<void> | void;

export interface ChatEventRegistry {
    dispatch: (events: readonly ServerDurableEvent[], serverId: string) => Promise<void>;
    register: <Type extends ChatEventType>(
        types: readonly Type[],
        handler: ChatEventHandler<Type>
    ) => () => void;
}

interface ChatEventRegistration {
    handler: (events: readonly ServerDurableEvent[], serverId: string) => Promise<void> | void;
    types: ReadonlySet<ChatEventType>;
}

export function createChatEventRegistry(): ChatEventRegistry {
    const registrations = new Set<ChatEventRegistration>();

    return {
        dispatch: async (events, serverId) => {
            const passes: (Promise<void> | void)[] = [];

            for (const registration of registrations) {
                if (events.some((event) => registration.types.has(event.type))) {
                    passes.push(registration.handler(events, serverId));
                }
            }

            await Promise.all(passes);
        },
        register: (types, handler) => {
            const registeredTypes = new Set<ChatEventType>(types);
            const registration: ChatEventRegistration = {
                handler: (events, serverId) =>
                    handler(
                        events.filter((event): event is ChatEventOf<(typeof types)[number]> =>
                            registeredTypes.has(event.type)
                        ),
                        serverId
                    ),
                types: registeredTypes,
            };
            registrations.add(registration);

            return () => {
                registrations.delete(registration);
            };
        },
    };
}
