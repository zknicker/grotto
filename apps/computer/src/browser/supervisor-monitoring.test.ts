import { expect, test } from 'bun:test';
import type { AgentRuntimeBrowserState } from '@haus/api';
import { BrowserCommandQueue } from './command-queue.ts';
import {
    createSupervisor,
    deferred,
    delay,
    FakeLifecycle,
    healthyObservation,
    unresponsiveObservation,
    waitUntil,
} from './supervisor-test-support.ts';

test('monitor cadence never overlaps observations or backlogs ticks', async () => {
    const lifecycle = new FakeLifecycle();
    const supervisor = createSupervisor(lifecycle, { sampleIntervalMs: 5 });
    await supervisor.start();

    const gate = deferred<void>();
    lifecycle.observeBehavior = async () => {
        await gate.promise;
        return healthyObservation;
    };
    await waitUntil(() => lifecycle.observeCount === 2);
    await delay(25);
    expect(lifecycle.observeCount).toBe(2);
    expect(lifecycle.maxConcurrentObservations).toBe(1);

    gate.resolve();
    await waitUntil(() => lifecycle.observeCount === 3);
    expect(lifecycle.observeCount).toBe(3);
    await supervisor.stop();
});

test('automatic recovery publishes recovering and records its attempt', async () => {
    const lifecycle = new FakeLifecycle();
    lifecycle.observation = unresponsiveObservation;
    lifecycle.restartBehavior = async () => {
        lifecycle.observation = healthyObservation;
    };
    const published: AgentRuntimeBrowserState[] = [];
    const supervisor = createSupervisor(lifecycle, {
        cdpFailureWindowMs: 0,
        onStatusChanged: (state) => published.push(state),
    });

    await supervisor.sample();
    const status = await supervisor.status();
    expect(lifecycle.restartCount).toBe(1);
    expect(status.restartBudget.automaticRestartsInWindow).toBe(1);
    expect(published).toEqual(['unresponsive', 'recovering', 'healthy']);
    await supervisor.stop();
});

test('failed evidence is best effort and a failed restart consumes budget', async () => {
    const lifecycle = new FakeLifecycle();
    lifecycle.observation = unresponsiveObservation;
    lifecycle.observeBehavior = async () => {
        if (lifecycle.observeCount === 2) {
            throw new Error('evidence unavailable');
        }
        return lifecycle.observation;
    };
    lifecycle.restartBehavior = async () => {
        lifecycle.observation = { ...healthyObservation, running: false };
        throw new Error('restart rejected');
    };
    const supervisor = createSupervisor(lifecycle, {
        cdpFailureWindowMs: 0,
        restartBudgetLimit: 1,
    });

    await supervisor.sample();
    const status = await supervisor.status();
    expect(lifecycle.restartCount).toBe(1);
    expect(status.restartBudget.automaticRestartsInWindow).toBe(1);
    expect(status.state).toBe('degraded');
    expect(status.reason).toBe('Browser recovery failed: restart rejected');
    await supervisor.stop();
});

test('automatic drain timeout defers without budget or a retained waiter', async () => {
    const lifecycle = new FakeLifecycle();
    lifecycle.observation = unresponsiveObservation;
    const queue = new BrowserCommandQueue();
    const commandGate = deferred<void>();
    const command = queue.run(() => commandGate.promise);
    const supervisor = createSupervisor(lifecycle, {
        cdpFailureWindowMs: 0,
        commandDrainTimeoutMs: 5,
        commandQueue: queue,
    });

    await supervisor.sample();
    const status = await supervisor.status();
    expect(lifecycle.restartCount).toBe(0);
    expect(status.restartBudget.automaticRestartsInWindow).toBe(0);
    expect(queue.drainWaiterCount).toBe(0);
    commandGate.resolve();
    await command;
    await supervisor.stop();
});
