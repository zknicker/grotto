import EventEmitter, { on } from 'node:events';
import { type HostedAgentLifecycleEvent, hostedAgentLifecycleEventSchema } from '@tavern/api';

const eventName = 'agent.lifecycle';
const emitter = new EventEmitter();

emitter.setMaxListeners(0);

type WithoutEmittedAt<Event> = Event extends unknown ? Omit<Event, 'emittedAt'> : never;
type LifecycleEventInput = WithoutEmittedAt<HostedAgentLifecycleEvent>;

export function publishAgentLifecycle(input: LifecycleEventInput) {
    const event = hostedAgentLifecycleEventSchema.parse({
        ...input,
        emittedAt: new Date().toISOString(),
    });
    emitter.emit(eventName, event);
    return event;
}

export async function* subscribeToAgentLifecycle(signal?: AbortSignal) {
    const iterator = signal ? on(emitter, eventName, { signal }) : on(emitter, eventName);

    for await (const [event] of iterator) {
        yield hostedAgentLifecycleEventSchema.parse(event);
    }
}
