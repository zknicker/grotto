import { describe, expect, test } from 'vitest';
import { BrowserCommandQueue } from './command-queue.ts';
import { BrowserSupervisor } from './supervisor.ts';
import type { BrowserLifecycleControl, BrowserObservation } from './types.ts';
import { stoppedBrowserObservation } from './types.ts';

const healthyObservation: BrowserObservation = {
    cdp: { latencyMs: 8, state: 'healthy' },
    contractCompatible: true,
    lockHeld: true,
    pid: 4242,
    resources: {
        browserCpuPercent: 3,
        browserRssBytes: 200_000_000,
        gpuCpuPercent: 5,
        gpuRssBytes: 50_000_000,
    },
    running: true,
    uptimeSeconds: 120,
};

class FakeLifecycle implements BrowserLifecycleControl {
    observation: BrowserObservation = healthyObservation;
    restartCount = 0;
    startCount = 0;
    stopCount = 0;
    onRestart: (() => void) | null = null;

    attachment() {
        return Promise.resolve({
            port: 9222,
            webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/browser/x',
        });
    }

    observe(): Promise<BrowserObservation> {
        return Promise.resolve(this.observation);
    }

    restart(): Promise<void> {
        this.restartCount += 1;
        this.onRestart?.();
        return Promise.resolve();
    }

    start(): Promise<void> {
        this.startCount += 1;
        return Promise.resolve();
    }

    stop(): Promise<void> {
        this.stopCount += 1;
        return Promise.resolve();
    }
}

function createSupervisor(overrides?: { lifecycle?: FakeLifecycle; queue?: BrowserCommandQueue }) {
    const lifecycle = overrides?.lifecycle ?? new FakeLifecycle();
    const queue = overrides?.queue ?? new BrowserCommandQueue();
    let nowMs = 1_000_000;
    const clock = { now: () => nowMs };
    const supervisor = new BrowserSupervisor({
        browserVersion: '149.0.0.0',
        clock,
        commandQueue: queue,
        lifecycle,
        policy: {
            cdpFailureWindowMs: 60_000,
            commandDrainTimeoutMs: 50,
            pressureGpuCpuPercent: 90,
            pressureWindowMs: 60_000,
            restartBudgetLimit: 2,
            restartBudgetWindowMs: 3_600_000,
            sampleIntervalMs: 999_999,
        },
    });
    return {
        advance(ms: number) {
            nowMs += ms;
        },
        lifecycle,
        queue,
        supervisor,
    };
}

describe('BrowserSupervisor state model', () => {
    test('reports healthy when Chrome runs under the contract with CDP responding', async () => {
        const { supervisor } = createSupervisor();
        const status = await supervisor.status();
        expect(status).toMatchObject({
            browserVersion: '149.0.0.0',
            cdpState: 'healthy',
            pid: 4242,
            reason: null,
            running: true,
            state: 'healthy',
        });
    });

    test('reports stopped when Chrome is not running', async () => {
        const { lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = stoppedBrowserObservation;
        expect(await supervisor.status()).toMatchObject({
            reason: 'Chrome is not running.',
            running: false,
            state: 'stopped',
        });
    });

    test('degrades on an incompatible launch contract', async () => {
        const { lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = { ...healthyObservation, contractCompatible: false };
        expect((await supervisor.status()).state).toBe('degraded');
    });

    test('degrades when the profile lock is missing', async () => {
        const { lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = { ...healthyObservation, lockHeld: false };
        expect((await supervisor.status()).state).toBe('degraded');
    });

    test('treats a fresh CDP failure as starting until the window elapses', async () => {
        const { advance, lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            cdp: { latencyMs: null, state: 'unreachable' },
        };
        expect((await supervisor.status()).state).toBe('starting');
        advance(59_000);
        expect((await supervisor.status()).state).toBe('starting');
        advance(2000);
        expect((await supervisor.status()).state).toBe('unresponsive');
    });

    test('sustained GPU pressure reports pressured while CDP responds', async () => {
        const { advance, lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            resources: { ...healthyObservation.resources, gpuCpuPercent: 97 },
        };
        expect((await supervisor.status()).state).toBe('healthy');
        advance(61_000);
        const status = await supervisor.status();
        expect(status.state).toBe('pressured');
        expect(status.pressureSince).not.toBeNull();
    });
});

describe('BrowserSupervisor guarded recovery', () => {
    test('pressure alone never restarts Chrome', async () => {
        const { advance, lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            resources: { ...healthyObservation.resources, gpuCpuPercent: 99 },
        };
        await supervisor.sample();
        advance(120_000);
        await supervisor.sample();
        expect(lifecycle.restartCount).toBe(0);
        expect((await supervisor.status()).state).toBe('pressured');
    });

    test('sustained CDP failure triggers restart with post-restart verification', async () => {
        const { advance, lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            cdp: { latencyMs: null, state: 'unreachable' },
        };
        await supervisor.sample();
        advance(61_000);
        lifecycle.onRestart = () => {
            lifecycle.observation = healthyObservation;
        };
        await supervisor.sample();
        expect(lifecycle.restartCount).toBe(1);
        expect((await supervisor.status()).state).toBe('healthy');
    });

    test('an active browser command inhibits recovery', async () => {
        const { advance, lifecycle, queue, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            cdp: { latencyMs: null, state: 'unreachable' },
        };
        await supervisor.sample();
        advance(61_000);

        let releaseCommand: () => void = () => undefined;
        const command = queue.run(
            () =>
                new Promise<void>((resolve) => {
                    releaseCommand = resolve;
                })
        );
        await supervisor.sample();
        expect(lifecycle.restartCount).toBe(0);
        releaseCommand();
        await command;
    });

    test('the automatic restart budget stops recovery loops and degrades', async () => {
        const { advance, lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            cdp: { latencyMs: null, state: 'unreachable' },
        };
        await supervisor.sample();
        advance(61_000);
        await supervisor.sample();
        await supervisor.sample();
        expect(lifecycle.restartCount).toBe(2);
        await supervisor.sample();
        await supervisor.sample();
        expect(lifecycle.restartCount).toBe(2);
        const status = await supervisor.status();
        expect(status.state).toBe('degraded');
        expect(status.reason).toContain('restart budget');
        expect(status.restartBudget).toMatchObject({
            automaticRestartLimit: 2,
            automaticRestartsInWindow: 2,
        });
    });

    test('a failed verification retries on later samples while budget remains', async () => {
        const { advance, lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            cdp: { latencyMs: null, state: 'unreachable' },
        };
        await supervisor.sample();
        advance(61_000);
        await supervisor.sample();
        expect(lifecycle.restartCount).toBe(1);
        expect((await supervisor.status()).state).toBe('unresponsive');
    });

    test('a recovery that leaves Chrome dead degrades Browser', async () => {
        const { advance, lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            cdp: { latencyMs: null, state: 'unreachable' },
        };
        await supervisor.sample();
        advance(61_000);
        lifecycle.onRestart = () => {
            lifecycle.observation = stoppedBrowserObservation;
        };
        await supervisor.sample();
        expect(lifecycle.restartCount).toBe(1);
        const status = await supervisor.status();
        expect(status.state).toBe('degraded');
        expect(status.reason).toContain('Browser recovery failed');
    });

    test('an operator restart heals a degraded browser without spending the budget', async () => {
        const { advance, lifecycle, supervisor } = createSupervisor();
        lifecycle.observation = {
            ...healthyObservation,
            cdp: { latencyMs: null, state: 'unreachable' },
        };
        await supervisor.sample();
        advance(61_000);
        await supervisor.sample();
        await supervisor.sample();
        expect((await supervisor.status()).state).toBe('degraded');
        expect(lifecycle.restartCount).toBe(2);

        lifecycle.onRestart = () => {
            lifecycle.observation = healthyObservation;
        };
        await supervisor.restartBrowser();
        const status = await supervisor.status();
        expect(status.state).toBe('healthy');
        expect(lifecycle.restartCount).toBe(3);
        expect(status.restartBudget.automaticRestartsInWindow).toBe(2);
    });
});
