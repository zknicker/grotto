import EventEmitter, { on } from 'node:events';
import type { ServerUpdatedEvent } from '@tavern/api';

/**
 * Server-scoped realtime notifications for the hosted Grotto Server. Delivery
 * is membership-checked by the subscription that consumes it. The wire shape is
 * the first-party contract in `@tavern/api`, so the App types its listener
 * against the same record this emits.
 */
const eventName = 'server.updated';
const emitter = new EventEmitter();

emitter.setMaxListeners(0);

/**
 * Announces a durable change after it commits. Pass `agentId` or `memberId`
 * whenever the change belongs to one record: the App invalidates that record's
 * detail read exactly, and falls back to the whole scope without them.
 */
export function emitServerUpdated(input: {
    agentId?: string;
    memberId?: string;
    scope?: ServerUpdatedEvent['scope'];
    serverId: string;
}) {
    emitter.emit(eventName, {
        agentId: input.agentId,
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
