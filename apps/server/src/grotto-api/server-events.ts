import EventEmitter, { on } from 'node:events';

/**
 * Server-scoped realtime notifications for the hosted Grotto Server. Delivery
 * is membership-checked by the subscription that consumes it.
 */
export interface ServerUpdatedEvent {
    emittedAt: string;
    scope: 'computer' | 'mcp' | 'server';
    serverId: string;
}

const eventName = 'server.updated';
const emitter = new EventEmitter();

emitter.setMaxListeners(0);

export function emitServerUpdated(input: {
    scope?: ServerUpdatedEvent['scope'];
    serverId: string;
}) {
    emitter.emit(eventName, {
        emittedAt: new Date().toISOString(),
        scope: input.scope ?? 'server',
        serverId: input.serverId,
    } satisfies ServerUpdatedEvent);
}

export async function* subscribeToServerUpdates(signal?: AbortSignal) {
    const iterator = signal ? on(emitter, eventName, { signal }) : on(emitter, eventName);

    for await (const [event] of iterator) {
        yield event as ServerUpdatedEvent;
    }
}
