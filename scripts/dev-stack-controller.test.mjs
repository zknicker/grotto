import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
    createDesktopDevEnvironment,
    DevStackController,
    signalChildProcessGroup,
    waitForChildShutdown,
} from './dev-stack-controller.mjs';

test('App development receives the Clerk issuer used by the Server UI', () => {
    assert.deepEqual(
        createDesktopDevEnvironment({
            clerkEnvironmentOverrides: {
                CLERK_ISSUER_URL: 'https://clerk.shared.lcl.dev',
            },
            devStackEnvironment: {
                PATH: '/usr/bin',
            },
            ports: {
                serverPort: 25_249,
                websitePort: 25_248,
            },
        }),
        {
            CLERK_ISSUER_URL: 'https://clerk.shared.lcl.dev',
            PATH: '/usr/bin',
            TAVERN_SERVER_PORT: '25249',
            TAVERN_WEBSITE_PORT: '25248',
        }
    );
});

test('dev stack shutdown signals all managed processes before waiting in order', async () => {
    const controller = new DevStackController({
        mode: 'desktop',
        ports: { serverPort: 80_800, websitePort: 31_000 },
        repositoryRoot: process.cwd(),
    });
    const desktop = createManagedChildProcessStub(12_341, { autoExit: false });
    const website = createManagedChildProcessStub(12_342);
    const server = createManagedChildProcessStub(12_343);

    controller.processes.set('desktop', desktop);
    controller.processes.set('website', website);
    controller.processes.set('server', server);

    const stopPromise = controller.stop(0);
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(desktop.signals, ['SIGTERM']);
    assert.deepEqual(website.signals, ['SIGTERM']);
    assert.deepEqual(server.signals, ['SIGTERM']);

    desktop.exitCode = 0;
    desktop.emit('exit', 0, null);
    await stopPromise;
});

test('dev stack shutdown forwards the operator signal to managed processes', async () => {
    const controller = new DevStackController({
        mode: 'web',
        ports: { serverPort: 80_800, websitePort: 31_000 },
        repositoryRoot: process.cwd(),
    });
    const website = createManagedChildProcessStub(12_342);
    const server = createManagedChildProcessStub(12_343);

    controller.processes.set('website', website);
    controller.processes.set('server', server);

    await controller.stop(130, { signal: 'SIGINT' });

    assert.deepEqual(website.signals, ['SIGINT']);
    assert.deepEqual(server.signals, ['SIGINT']);
});

test('waitForChildShutdown waits after the shell exits until the process group is gone', async () => {
    const child = createChildProcessStub();
    let groupActive = true;
    const startedAt = Date.now();

    const stopped = await waitForChildShutdown(
        child,
        () => {
            child.exitCode = 0;
            child.emit('exit', 0, null);
            setTimeout(() => {
                groupActive = false;
            }, 20);
        },
        {
            isProcessGroupActive: () => groupActive,
            pollMs: 1,
            timeoutMs: 250,
        }
    );

    assert.equal(stopped, true);
    assert.ok(Date.now() - startedAt >= 15);
});

test('waitForChildShutdown times out when the process group survives the shell', async () => {
    const child = createChildProcessStub();

    const stopped = await waitForChildShutdown(
        child,
        () => {
            child.exitCode = 0;
            child.emit('exit', 0, null);
        },
        {
            isProcessGroupActive: () => true,
            pollMs: 1,
            timeoutMs: 10,
        }
    );

    assert.equal(stopped, false);
});

test('signalChildProcessGroup can signal surviving groups after the shell exits', () => {
    const child = createChildProcessStub();
    const signals = [];

    child.exitCode = 0;

    const signaled = signalChildProcessGroup(child, 'SIGKILL', (pid, signal) => {
        signals.push({ pid, signal });
    });

    assert.equal(signaled, true);
    assert.deepEqual(signals, [{ pid: -12_345, signal: 'SIGKILL' }]);
});

test('managed processes launch directly without an intermediate shell', () => {
    const spawnCalls = [];
    const child = createManagedChildProcessStub(12_346, { autoExit: false });
    const controller = new DevStackController({
        mode: 'web',
        ports: { serverPort: 80_800, websitePort: 31_000 },
        repositoryRoot: process.cwd(),
        spawnImpl: (...args) => {
            spawnCalls.push(args);
            return child;
        },
    });

    controller.spawnProcess('server', 'bun', ['--watch', 'src/index.ts'], {
        cwd: '/tmp/tavern-server',
        env: { TAVERN_SERVER_PORT: '80800' },
    });

    assert.deepEqual(spawnCalls, [
        [
            'bun',
            ['--watch', 'src/index.ts'],
            {
                cwd: '/tmp/tavern-server',
                detached: true,
                env: { TAVERN_SERVER_PORT: '80800' },
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe'],
            },
        ],
    ]);
});

function createChildProcessStub() {
    const child = new EventEmitter();
    child.exitCode = null;
    child.kill = () => {
        throw new Error('child.kill should not be called');
    };
    child.off = child.removeListener.bind(child);
    child.pid = 12_345;
    child.signalCode = null;
    return child;
}

function createManagedChildProcessStub(pid, options = {}) {
    const child = new EventEmitter();
    child.exitCode = null;
    child.kill = (signal) => {
        child.signals.push(signal);
        if (options.autoExit !== false) {
            child.signalCode = signal;
            child.emit('exit', null, signal);
        }
        return true;
    };
    child.off = child.removeListener.bind(child);
    child.pid = pid;
    child.signalCode = null;
    child.signals = [];
    return child;
}
