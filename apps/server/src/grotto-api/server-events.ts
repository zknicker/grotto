import EventEmitter, { on } from 'node:events';
import type { ServerUpdatedEvent } from '@grotto/api';

/**
 * Server-scoped realtime notifications for the Grotto Server. Delivery
 * is membership-checked by the subscription that consumes it. The wire shape is
 * the first-party contract in `@grotto/api`, so the App types its listener
 * against the same record this emits.
 */
const eventName = 'server.updated';
const emitter = new EventEmitter();

emitter.setMaxListeners(0);

/**
 * Announces a durable change after it commits. Pass the Agent, Computer, or
 * member id whenever the change belongs to one record. The App invalidates that
 * record's detail read exactly and falls back to the whole scope without it.
 */
export function emitServerUpdated(input: {
    agentId?: string;
    computerId?: string;
    memberId?: string;
    scope?: ServerUpdatedEvent['scope'];
    serverId: string;
}) {
    emitter.emit(eventName, {
        agentId: input.agentId,
        computerId: input.computerId,
        emittedAt: new Date().toISOString(),
        memberId: input.memberId,
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
