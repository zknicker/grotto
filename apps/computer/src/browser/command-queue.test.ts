import { expect, test } from 'bun:test';
import { BrowserCommandQueue } from './command-queue.ts';

test('aborting a drain wait removes its waiter without cancelling the command', async () => {
    const queue = new BrowserCommandQueue();
    const commandGate = deferred();
    const command = queue.run(() => commandGate.promise);
    const controller = new AbortController();
    const waiting = queue.waitForDrain(controller.signal).catch((error: unknown) => error);
    expect(queue.drainWaiterCount).toBe(1);

    controller.abort();
    expect(await waiting).toBeInstanceOf(Error);
    expect(queue.drainWaiterCount).toBe(0);
    expect(queue.inFlightCount).toBe(1);
    commandGate.resolve();
    await command;
});

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
