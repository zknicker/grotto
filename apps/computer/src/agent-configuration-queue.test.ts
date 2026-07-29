import { expect, test } from 'bun:test';
import { AgentConfigurationQueue } from './agent-configuration-queue.ts';

test('a start waits for the latest queued Agent configuration', async () => {
    const queue = new AgentConfigurationQueue();
    const firstGate = Promise.withResolvers<void>();
    const events: string[] = [];

    const first = queue.enqueue('agt_test', async () => {
        await firstGate.promise;
        events.push('first configuration');
    });
    const second = queue.enqueue('agt_test', async () => {
        events.push('second configuration');
    });
    const start = queue.wait('agt_test').then(() => {
        events.push('start');
    });

    expect(events).toEqual([]);
    firstGate.resolve();
    await Promise.all([first, second, start]);
    expect(events).toEqual(['first configuration', 'second configuration', 'start']);
});
