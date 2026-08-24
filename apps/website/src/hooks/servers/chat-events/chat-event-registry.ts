import type { ServerDurableEvent } from '@grotto/api';

export type ChatEventType = ServerDurableEvent['type'];

export type ChatEventOf<Type extends ChatEventType> = Extract<ServerDurableEvent, { type: Type }>;

/**
 * One listener's pass over a drained batch: every event of its own types, in
 * arrival order, plus the Server those events arrived on.
 */
export type ChatEventHandler<Type extends ChatEventType> = (
    events: ChatEventOf<Type>[],
    serverId: string
) => Promise<void> | void;

export interface ChatEventRegistry {
    /**
     * Hands each listener the pass's events of its own types, one call per
     * listener per pass, so per-type coalescing survives a burst.
     */
    dispatch: (events: readonly ServerDurableEvent[], serverId: string) => Promise<void>;
    /** Registers one listener for its event types. Returns its unregister. */
    register: <Type extends ChatEventType>(
        types: readonly Type[],
        handler: ChatEventHandler<Type>
    ) => () => void;
}

interface ChatEventRegistration {
    /** Takes the whole pass and keeps its own types, so no listener sees another's events. */
    handler: (events: readonly ServerDurableEvent[], serverId: string) => Promise<void> | void;
    types: ReadonlySet<ChatEventType>;
}

/**
 * Who listens to which Chat event type. Kept outside React so a batch flush and
 * a catch-up walk dispatch through the same table without re-rendering.
 */
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
