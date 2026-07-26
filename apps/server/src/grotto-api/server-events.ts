import EventEmitter, { on } from 'node:events';

/**
 * Server-scoped realtime notifications for the hosted Grotto Server. Delivery
 * is membership-checked by the subscription that consumes it.
 */
export interface ServerUpdatedEvent {
    emittedAt: string;
    serverId: string;
}

const eventName = 'server.updated';
const emitter = new EventEmitter();

emitter.setMaxListeners(0);

export function emitServerUpdated(input: { serverId: string }) {
    emitter.emit(eventName, {
        emittedAt: new Date().toISOString(),
        serverId: input.serverId,
    } satisfies ServerUpdatedEvent);
}

export async function* subscribeToServerUpdates(signal?: AbortSignal) {
    const iterator = signal ? on(emitter, eventName, { signal }) : on(emitter, eventName);

    for await (const [event] of iterator) {
        yield event as ServerUpdatedEvent;
    }
}
