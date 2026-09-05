import { expect, test } from 'bun:test';
import { Cause, Chunk, Effect, Runtime } from 'effect';
import { BrowserCommandQueue } from './command-queue.ts';
import { BrowserSupervisorStoppedError } from './supervisor.ts';
import {
    createSupervisor,
    deferred,
    delay,
    FakeLifecycle,
    testRuntime,
    unresponsiveObservation,
    waitUntil,
} from './supervisor-test-support.ts';

test('shutdown cancels a drain wait and rejects queued work', async () => {
    const lifecycle = new FakeLifecycle();
    lifecycle.observation = unresponsiveObservation;
    const queue = new BrowserCommandQueue();
    const commandGate = deferred<void>();
    const command = queue.run(() => commandGate.promise);
    const supervisor = createSupervisor(lifecycle, {
        cdpFailureWindowMs: 0,
        commandDrainTimeoutMs: 1000,
        commandQueue: queue,
    });
    const sampleResult = supervisor.sample().catch((error: unknown) => error);
    const queuedResult = supervisor.status().catch((error: unknown) => error);
    await waitUntil(() => queue.drainWaiterCount === 1);

    await supervisor.stop();
    expect(queue.drainWaiterCount).toBe(0);
    expect(await sampleResult).toBeInstanceOf(BrowserSupervisorStoppedError);
    expect(await queuedResult).toBeInstanceOf(BrowserSupervisorStoppedError);
    commandGate.resolve();
    await command;
});

test('shutdown waits for a started non-abortable lifecycle promise', async () => {
    const lifecycle = new FakeLifecycle();
    lifecycle.observation = unresponsiveObservation;
    const restartGate = deferred<void>();
    lifecycle.restartBehavior = () => restartGate.promise;
    const supervisor = createSupervisor(lifecycle, { cdpFailureWindowMs: 0 });
    const sampleResult = supervisor.sample().catch((error: unknown) => error);
    await waitUntil(() => lifecycle.restartCount === 1);

    let stopped = false;
    const stopPromise = supervisor.stop();
    expect(supervisor.stop('stop-browser')).toBe(stopPromise);
    const stopping = stopPromise.then(() => {
        stopped = true;
    });
    await delay(10);
    expect(stopped).toBe(false);
    restartGate.resolve();
    await stopping;
    expect(lifecycle.stopCount).toBe(1);
    expect(await sampleResult).toBeInstanceOf(BrowserSupervisorStoppedError);
});

test('manual restart proceeds after drain timeout without charging automatic budget', async () => {
    const lifecycle = new FakeLifecycle();
    const queue = new BrowserCommandQueue();
    const commandGate = deferred<void>();
    const command = queue.run(() => commandGate.promise);
    const supervisor = createSupervisor(lifecycle, {
        commandDrainTimeoutMs: 5,
        commandQueue: queue,
    });

    await supervisor.restartBrowser();
    expect(lifecycle.restartCount).toBe(1);
    expect((await supervisor.status()).restartBudget.automaticRestartsInWindow).toBe(0);
    commandGate.resolve();
    await command;
    await supervisor.stop();
});

test('stop is idempotent and post-stop calls reject with ordinary errors', async () => {
    const lifecycle = new FakeLifecycle();
    const supervisor = createSupervisor(lifecycle);
    const first = supervisor.stop();
    const second = supervisor.stop();
    expect(second).toBe(first);
    await first;

    const error = await supervisor.status().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BrowserSupervisorStoppedError);
    expect(String(error)).not.toContain('FiberFailure');
    expect(String(error)).not.toContain('Cause');
    expect(lifecycle.stopCount).toBe(0);
});

test('request settlement preserves a lifecycle failure identity', async () => {
    const lifecycle = new FakeLifecycle();
    const failure = new Error('restart failed');
    lifecycle.restartBehavior = async () => {
        throw failure;
    };
    const supervisor = createSupervisor(lifecycle);

    await expect(supervisor.restartBrowser()).rejects.toBe(failure);
    await supervisor.stop();
});

test('request settlement preserves a composite defect cause', async () => {
    const lifecycle = new FakeLifecycle();
    const runtime = testRuntime();
    const supervisor = createSupervisor(lifecycle, {}, runtime);
    const defect = new Error('browser defect');
    Reflect.set(supervisor, 'operations', {
        status: () =>
            Effect.fail(new Error('browser failure')).pipe(Effect.ensuring(Effect.die(defect))),
    });

    const rejection = supervisor.status();
    await rejection.catch((error: unknown) => {
        expect(Runtime.isFiberFailure(error)).toBe(true);
        if (Runtime.isFiberFailure(error)) {
            expect(
                Chunk.toReadonlyArray(Cause.defects(error[Runtime.FiberFailureCauseId]))
            ).toContain(defect);
        }
    });
    await supervisor.stop();
});
