import EventEmitter, { on } from 'node:events';
import type { HostedCompositionEvent } from '@tavern/api';

const eventName = 'chat.composition';
const emitter = new EventEmitter();

emitter.setMaxListeners(0);

export function publishChatComposition(event: HostedCompositionEvent) {
    emitter.emit(eventName, event);
}

export async function* subscribeToChatCompositions(signal?: AbortSignal) {
    const iterator = signal ? on(emitter, eventName, { signal }) : on(emitter, eventName);

    for await (const [event] of iterator) {
        yield event as HostedCompositionEvent;
    }
}
