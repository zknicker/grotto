import EventEmitter, { on } from 'node:events';
import type { HostedDurableEvent } from '@tavern/api';

const eventName = 'chat.durable';
const emitter = new EventEmitter();

emitter.setMaxListeners(0);

export interface DurableChatNotification {
    audienceUserId: string | null;
    event: HostedDurableEvent;
}

export function emitDurableChatEvent(notification: DurableChatNotification) {
    emitter.emit(eventName, notification);
}

export async function* subscribeToDurableChatEvents(signal?: AbortSignal) {
    const iterator = signal ? on(emitter, eventName, { signal }) : on(emitter, eventName);

    for await (const [notification] of iterator) {
        yield notification as DurableChatNotification;
    }
}
