import { expect, test } from 'bun:test';
import { emitServerUpdated, subscribeToServerUpdates } from './server-events.ts';

test('server update subscriptions preserve the domain scope', async () => {
    const controller = new AbortController();
    const iterator = subscribeToServerUpdates(controller.signal)[Symbol.asyncIterator]();
    const next = iterator.next();

    emitServerUpdated({ scope: 'mcp', serverId: 'srv_test' });

    const event = await next;
    controller.abort();

    expect(event.value).toMatchObject({
        scope: 'mcp',
        serverId: 'srv_test',
    });
});
