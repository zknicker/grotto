import { afterEach, expect, mock, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type DaemonRuntime, makeDaemonRuntime } from '../daemon-runtime.ts';
import { BrowserCommandQueue } from './command-queue.ts';
import type { BrowserService } from './service.ts';
import { BrowserSupervisor, BrowserSupervisorStoppedError } from './supervisor.ts';
import type { BrowserLifecycleControl, BrowserObservation } from './types.ts';

mock.module('./chrome-detection.ts', () => ({
    detectChromeApplications: async () => [
        {
            executablePath: '/tmp/fake-chrome',
            path: '/Applications/Fake Chrome.app',
            version: '123',
        },
    ],
}));

const {
    BrowserServiceCoordinator,
    getBrowserService,
    startBrowserService,
    stopBrowserService,
    teardownBrowserService,
} = await import('./service.ts');
const { reconcileComputerBrowser } = await import('./settings.ts');

const runtimes = new Set<DaemonRuntime>();

afterEach(async () => {
    await stopBrowserService();
    await Promise.all([...runtimes].map((runtime) => runtime.dispose()));
    runtimes.clear();
});

test('profile teardown settles observation and Chrome stop before releasing the lock', async () => {
    const observeStarted = deferred();
    const observeGate = deferred();
    const stopStarted = deferred();
    const stopGate = deferred();
    const events: string[] = [];
    const lifecycle: BrowserLifecycleControl = {
        attachment: async () => ({ port: 9222, webSocketDebuggerUrl: 'ws://browser' }),
        observe: async () => {
            events.push('observe started');
            observeStarted.resolve();
            await observeGate.promise;
            events.push('observe settled');
            return stoppedObservation;
        },
        restart: async () => undefined,
        start: async () => undefined,
        stop: async () => {
            events.push('Chrome stop started');
            stopStarted.resolve();
            await stopGate.promise;
            events.push('Chrome stop settled');
        },
    };
    const runtime = testRuntime();
    const supervisor = new BrowserSupervisor({
        browserVersion: '123',
        commandQueue: new BrowserCommandQueue(),
        lifecycle,
        runtime,
    });
    const status = supervisor.status().catch((error: unknown) => error);
    await observeStarted.promise;

    const teardown = teardownBrowserService(
        {
            lock: { release: () => events.push('lock released') },
            supervisor,
        },
        'stop-browser'
    );
    await Promise.resolve();
    expect(events).toEqual(['observe started']);

    observeGate.resolve();
    await stopStarted.promise;
    expect(events).toEqual(['observe started', 'observe settled', 'Chrome stop started']);
    stopGate.resolve();
    await teardown;
    expect(events).toEqual([
        'observe started',
        'observe settled',
        'Chrome stop started',
        'Chrome stop settled',
        'lock released',
    ]);
    expect(await status).toBeInstanceOf(BrowserSupervisorStoppedError);
});

test('reconciling a disabled root preserves another root service', async () => {
    const runtime = testRuntime();
    const directory = await mkdtemp(join(tmpdir(), 'grotto-browser-roots-'));
    const activeRoot = join(directory, 'active');
    const disabledRoot = join(directory, 'disabled');
    try {
        const service = await startBrowserService(
            {
                launchBrowser: false,
                profileName: 'default',
                root: activeRoot,
            },
            runtime
        );
        expect(service).not.toBeNull();

        await reconcileComputerBrowser(disabledRoot, runtime);

        expect(getBrowserService()).toBe(service);
    } finally {
        await stopBrowserService();
        await rm(directory, { force: true, recursive: true });
    }
});

test('disable waits for a delayed start and leaves no active service', async () => {
    const harness = createCoordinatorHarness();
    const starting = harness.coordinator.start({ profileName: 'default', root: '/first' });
    await waitUntil(() => harness.lifecycle.startCount === 1);
    let configRead = false;
    const disabling = harness.coordinator.reconcile('/first', async () => {
        configRead = true;
        return { enabled: false, profileName: 'default' };
    });

    await Promise.resolve();
    expect(configRead).toBe(false);
    harness.startGate.resolve();
    const service = await starting;
    await disabling;

    expect(configRead).toBe(true);
    expect(harness.coordinator.get()).toBeNull();
    expect(harness.lifecycle.stopCount).toBe(1);
    expect(harness.releaseCount()).toBe(1);
    expect(await service?.supervisor.status().catch((error: unknown) => error)).toBeInstanceOf(
        BrowserSupervisorStoppedError
    );
});

test('two concurrent delayed starts retain one supervisor and command FIFO', async () => {
    const harness = createCoordinatorHarness();
    const firstStart = harness.coordinator.start({ profileName: 'default', root: '/first' });
    await waitUntil(() => harness.lifecycle.startCount === 1);
    const secondStart = harness.coordinator.start({ profileName: 'default', root: '/first' });
    await Promise.resolve();
    expect(harness.createdCount()).toBe(1);

    harness.startGate.resolve();
    const [first, second] = await Promise.all([firstStart, secondStart]);

    expect(first).toBe(second);
    expect(harness.coordinator.get()).toBe(first);
    expect(first?.supervisor).toBe(second?.supervisor);
    expect(first?.commandQueue).toBe(second?.commandQueue);
    expect(harness.createdCount()).toBe(1);
    await harness.coordinator.stop('stop-browser');
    expect(harness.lifecycle.stopCount).toBe(1);
    expect(harness.releaseCount()).toBe(1);
});

const stoppedObservation: BrowserObservation = {
    cdp: { latencyMs: null, state: 'unknown' },
    contractCompatible: true,
    lockHeld: true,
    pid: null,
    resources: {
        browserCpuPercent: null,
        browserRssBytes: null,
        gpuCpuPercent: null,
        gpuRssBytes: null,
    },
    running: false,
    uptimeSeconds: null,
};

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function createCoordinatorHarness() {
    const runtime = testRuntime();
    const startGate = deferred();
    const lifecycle = new DelayedStartLifecycle(startGate.promise);
    let created = 0;
    let releases = 0;
    const coordinator = new BrowserServiceCoordinator(runtime, {
        create: (supervisorRuntime, application, options) => {
            created += 1;
            const commandQueue = new BrowserCommandQueue();
            return {
                application,
                commandQueue,
                contract: {
                    executablePath: application.executablePath,
                    userDataDir: `/tmp/${options.profileName}`,
                },
                lock: { release: () => (releases += 1) },
                profileName: options.profileName,
                root: options.root,
                supervisor: new BrowserSupervisor({
                    browserVersion: application.version,
                    commandQueue,
                    lifecycle,
                    policy: { sampleIntervalMs: 60_000 },
                    runtime: supervisorRuntime,
                }),
            } satisfies BrowserService;
        },
        detect: async () => [
            {
                executablePath: '/tmp/fake-chrome',
                path: '/Applications/Fake Chrome.app',
                version: '123',
            },
        ],
    });
    return {
        coordinator,
        createdCount: () => created,
        lifecycle,
        releaseCount: () => releases,
        startGate,
    };
}

function testRuntime(): DaemonRuntime {
    const runtime = makeDaemonRuntime();
    runtimes.add(runtime);
    return runtime;
}

class DelayedStartLifecycle implements BrowserLifecycleControl {
    startCount = 0;
    stopCount = 0;

    constructor(private readonly startGate: Promise<void>) {}

    attachment() {
        return Promise.resolve({ port: 9222, webSocketDebuggerUrl: 'ws://browser' });
    }

    observe(): Promise<BrowserObservation> {
        return Promise.resolve(stoppedObservation);
    }

    restart(): Promise<void> {
        return Promise.resolve();
    }

    async start(): Promise<void> {
        this.startCount += 1;
        await this.startGate;
    }

    stop(): Promise<void> {
        this.stopCount += 1;
        return Promise.resolve();
    }
}

async function waitUntil(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 500;
    while (!condition()) {
        if (Date.now() >= deadline) {
            throw new Error('Timed out waiting for Browser service transition.');
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
}
