import { expect, test } from 'bun:test';
import { emitServerUpdated, subscribeToServerUpdates } from '../src/grotto-api/server-events.ts';

test('Computer reports carry a focused realtime invalidation scope', async () => {
    const controller = new AbortController();
    const updates = subscribeToServerUpdates(controller.signal);
    const next = updates.next();

    emitServerUpdated({ scope: 'computer', serverId: 'srv_computer_scope' });

    expect((await next).value).toMatchObject({
        scope: 'computer',
        serverId: 'srv_computer_scope',
    });
    controller.abort();
});
