import { afterEach } from 'bun:test';
import type { AgentRuntimeBrowserState } from '@haus/api';
import { type DaemonRuntime, makeDaemonRuntime } from '../daemon-runtime.ts';
import { BrowserCommandQueue } from './command-queue.ts';
import { BrowserSupervisor } from './supervisor.ts';
import type { BrowserSupervisorPolicy } from './supervisor-policy.ts';
import type { BrowserLifecycleControl, BrowserObservation, CdpAttachment } from './types.ts';

export const healthyObservation: BrowserObservation = {
    cdp: { latencyMs: 3, state: 'healthy' },
    contractCompatible: true,
    lockHeld: true,
    pid: 41,
    resources: {
        browserCpuPercent: 2,
        browserRssBytes: 100,
        gpuCpuPercent: 3,
        gpuRssBytes: 50,
    },
    running: true,
    uptimeSeconds: 12,
};

export const unresponsiveObservation: BrowserObservation = {
    ...healthyObservation,
    cdp: { latencyMs: null, state: 'unreachable' },
};

const runtimes = new Set<DaemonRuntime>();

afterEach(async () => {
    await Promise.all([...runtimes].map((runtime) => runtime.dispose()));
    runtimes.clear();
});

export function createSupervisor(
    lifecycle: BrowserLifecycleControl,
    options: {
        cdpFailureWindowMs?: number;
        commandDrainTimeoutMs?: number;
        commandQueue?: BrowserCommandQueue;
        onStatusChanged?: (state: AgentRuntimeBrowserState) => void;
        restartBudgetLimit?: number;
        sampleIntervalMs?: number;
    } = {},
    runtime = testRuntime()
): BrowserSupervisor {
    const policy: Partial<BrowserSupervisorPolicy> = {};
    if (options.cdpFailureWindowMs !== undefined) {
        policy.cdpFailureWindowMs = options.cdpFailureWindowMs;
    }
    if (options.commandDrainTimeoutMs !== undefined) {
        policy.commandDrainTimeoutMs = options.commandDrainTimeoutMs;
    }
    if (options.restartBudgetLimit !== undefined) {
        policy.restartBudgetLimit = options.restartBudgetLimit;
    }
    if (options.sampleIntervalMs !== undefined) {
        policy.sampleIntervalMs = options.sampleIntervalMs;
    }
    return new BrowserSupervisor({
        browserVersion: '123',
        commandQueue: options.commandQueue ?? new BrowserCommandQueue(),
        lifecycle,
        onStatusChanged: options.onStatusChanged,
        policy: { sampleIntervalMs: 60_000, ...policy },
        runtime,
    });
}

export function testRuntime(): DaemonRuntime {
    const runtime = makeDaemonRuntime();
    runtimes.add(runtime);
    return runtime;
}

export class FakeLifecycle implements BrowserLifecycleControl {
    observation = healthyObservation;
    observeBehavior: (() => Promise<BrowserObservation>) | null = null;
    restartBehavior: (() => Promise<void>) | null = null;
    observeCount = 0;
    restartCount = 0;
    startCount = 0;
    stopCount = 0;
    private activeObservations = 0;
    maxConcurrentObservations = 0;

    attachment(): Promise<CdpAttachment> {
        return Promise.resolve({ port: 9222, webSocketDebuggerUrl: 'ws://browser' });
    }

    async observe(): Promise<BrowserObservation> {
        this.observeCount += 1;
        this.activeObservations += 1;
        this.maxConcurrentObservations = Math.max(
            this.maxConcurrentObservations,
            this.activeObservations
        );
        try {
            return this.observeBehavior ? await this.observeBehavior() : this.observation;
        } finally {
            this.activeObservations -= 1;
        }
    }

    async restart(): Promise<void> {
        this.restartCount += 1;
        await this.restartBehavior?.();
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

export function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

export async function waitUntil(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 500;
    while (!condition()) {
        if (Date.now() >= deadline) {
            throw new Error('Timed out waiting for Browser supervisor state.');
        }
        await delay(1);
    }
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
