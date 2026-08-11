import { expect, test } from 'bun:test';
import {
    lifecycleEvent,
    messageEvent,
    readEvent,
    reminderEvent,
    taskEvent,
} from './chat-event-fixtures.ts';
import { createChatEventRegistry } from './chat-event-registry.ts';

const serverId = 'server_one';

test('a burst reaches each listener once, carrying only its own event type', async () => {
    const registry = createChatEventRegistry();
    const messagePasses: string[][] = [];
    const readPasses: string[][] = [];

    registry.register(['message.created'], (events) => {
        messagePasses.push(events.map((event) => event.chatId));
    });
    registry.register(['chat.read'], (events) => {
        readPasses.push(events.map((event) => event.chatId));
    });

    await registry.dispatch(
        [
            messageEvent('2', 'chat_one'),
            messageEvent('3', 'chat_two'),
            readEvent('4', 'chat_one'),
            lifecycleEvent('5', 'chat_three', 'created'),
        ],
        serverId
    );

    expect(messagePasses).toEqual([['chat_one', 'chat_two']]);
    expect(readPasses).toEqual([['chat_one']]);
});

test('one lane registered for several types receives them in a single pass', async () => {
    const registry = createChatEventRegistry();
    const passes: string[][] = [];

    registry.register(['task.created', 'task.updated'], (events) => {
        passes.push(events.map((event) => event.type));
    });

    await registry.dispatch(
        [taskEvent('2', 'chat_one', 'task.created'), taskEvent('3', 'chat_one', 'task.updated')],
        serverId
    );

    expect(passes).toEqual([['task.created', 'task.updated']]);
});

test('an unmatched event type dispatches nothing, and the Server travels with the pass', async () => {
    const registry = createChatEventRegistry();
    const passes: string[] = [];

    registry.register(['message.created'], (_events, eventServerId) => {
        passes.push(eventServerId);
    });

    await registry.dispatch([reminderEvent('2', 'chat_one')], serverId);
    expect(passes).toEqual([]);

    await registry.dispatch([messageEvent('3', 'chat_one')], serverId);
    expect(passes).toEqual([serverId]);
});

test('dispatch awaits every listener and stops once a listener unregisters', async () => {
    const registry = createChatEventRegistry();
    const settled: string[] = [];
    const unregister = registry.register(['message.created'], async () => {
        await Promise.resolve();
        settled.push('message');
    });

    await registry.dispatch([messageEvent('2', 'chat_one')], serverId);
    expect(settled).toEqual(['message']);

    unregister();
    await registry.dispatch([messageEvent('3', 'chat_one')], serverId);
    expect(settled).toEqual(['message']);
});
