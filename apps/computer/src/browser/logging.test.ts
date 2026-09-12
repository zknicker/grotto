import { afterEach, expect, test } from 'bun:test';
import { makeTestRuntime } from '@haus/effect';
import { BrowserServiceCoordinator } from './service.ts';
import {
    createSupervisor,
    FakeLifecycle,
    healthyObservation,
    unresponsiveObservation,
} from './supervisor-test-support.ts';

type TestRuntime = ReturnType<typeof makeTestRuntime>;

const runtimes = new Set<TestRuntime>();

afterEach(async () => {
    await Promise.all([...runtimes].map((runtime) => runtime.dispose()));
    runtimes.clear();
});

test('missing Chrome is logged through the process logger with closed safe annotations', async () => {
    const logs = recordedLogs();
    const runtime = testRuntime(logs);
    const coordinator = new BrowserServiceCoordinator(runtime, {
        create: () => {
            throw new Error('A service must not be created without Chrome.');
        },
        detect: async () => [],
    });

    expect(await coordinator.start({ profileName: 'default', root: '/browser' })).toBeNull();
    expect(logs.warnings).toEqual([
        [
            'Browser supervision is unavailable because Chrome was not detected.',
            { failureKind: 'unavailable', operation: 'browser.detect' },
        ],
    ]);
});

test('automatic recovery logs redact the foreign failure while health keeps its reason', async () => {
    const logs = recordedLogs();
    const runtime = testRuntime(logs);
    const lifecycle = new FakeLifecycle();
    lifecycle.observation = unresponsiveObservation;
    lifecycle.restartBehavior = async () => {
        lifecycle.observation = { ...healthyObservation, running: false };
        throw new Error('credential=do-not-log');
    };
    const supervisor = createSupervisor(
        lifecycle,
        { cdpFailureWindowMs: 0, restartBudgetLimit: 1 },
        runtime
    );

    await supervisor.sample();

    expect((await supervisor.status()).reason).toBe(
        'Browser recovery failed: credential=do-not-log'
    );
    expect(logs.warnings).toEqual([
        [
            'Browser automatic recovery is starting.',
            { failureKind: 'unresponsive', operation: 'browser.recovery' },
        ],
    ]);
    expect(logs.errors).toEqual([
        [
            'Browser automatic recovery failed; supervision will continue.',
            { failureKind: 'external', operation: 'browser.recovery' },
        ],
    ]);
    expect(JSON.stringify(logs)).not.toContain('do-not-log');
    await supervisor.stop();
});

test('a failed status listener is logged and does not fail status sampling', async () => {
    const logs = recordedLogs();
    const runtime = testRuntime(logs);
    const supervisor = createSupervisor(
        new FakeLifecycle(),
        {
            onStatusChanged: () => {
                throw new Error('listener-private-detail');
            },
        },
        runtime
    );

    expect((await supervisor.status()).state).toBe('healthy');
    expect(logs.warnings).toEqual([
        [
            'Browser status publication failed; supervision will continue.',
            { failureKind: 'external', operation: 'browser.status-publish' },
        ],
    ]);
    expect(JSON.stringify(logs)).not.toContain('listener-private-detail');
    await supervisor.stop();
});

interface RecordedLogs {
    errors: unknown[][];
    infos: unknown[][];
    warnings: unknown[][];
}

function recordedLogs(): RecordedLogs {
    return { errors: [], infos: [], warnings: [] };
}

function testRuntime(logs: RecordedLogs): TestRuntime {
    const ignore = (..._values: readonly unknown[]) => undefined;
    const runtime = makeTestRuntime({
        output: {
            debug: ignore,
            error: (...values) => logs.errors.push([...values]),
            info: (...values) => logs.infos.push([...values]),
            log: ignore,
            trace: ignore,
            warn: (...values) => logs.warnings.push([...values]),
        },
    });
    runtimes.add(runtime);
    return runtime;
}
