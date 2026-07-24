import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { buildLaunchArguments, cookieModeMarkerPath } from './launch-contract.ts';
import { ChromeLifecycle } from './lifecycle.ts';
import { ProfileLock } from './profile-lock.ts';
import type {
    CdpProber,
    CdpSnapshot,
    ChromeProcessControl,
    ProcessListReader,
    ProcessRecord,
} from './types.ts';

const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let tempRoot: string;
let userDataDir: string;

class FakeWorld implements ProcessListReader, CdpProber, ChromeProcessControl {
    processes: ProcessRecord[] = [];
    cdpState: CdpSnapshot['state'] = 'healthy';
    spawned: string[][] = [];
    signals: Array<{ pid: number; signal: string }> = [];
    exitOnSigterm = true;
    exitOnSigkill = true;
    private nextPid = 5000;

    read(): Promise<ProcessRecord[]> {
        return Promise.resolve(this.processes);
    }

    probe(): Promise<CdpSnapshot> {
        return Promise.resolve({
            latencyMs: this.cdpState === 'healthy' ? 5 : null,
            state: this.cdpState,
        });
    }

    attachment() {
        return Promise.resolve({
            port: 9222,
            webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/browser/x',
        });
    }

    isAlive(pid: number): boolean {
        return this.processes.some((record) => record.pid === pid);
    }

    signal(pid: number, signal: 'SIGKILL' | 'SIGTERM'): void {
        this.signals.push({ pid, signal });
        const shouldExit =
            (signal === 'SIGTERM' && this.exitOnSigterm) ||
            (signal === 'SIGKILL' && this.exitOnSigkill);
        if (shouldExit) {
            this.processes = this.processes.filter((record) => record.pid !== pid);
        }
    }

    spawnDetached(binary: string, args: string[]): number {
        this.spawned.push([binary, ...args]);
        const pid = this.nextPid;
        this.nextPid += 1;
        this.processes.push(managedRoot(pid, args.join(' ')));
        return pid;
    }
}

function managedRoot(pid: number, command?: string): ProcessRecord {
    return {
        command:
            command === undefined
                ? `${executablePath} ${buildLaunchArguments({ executablePath, userDataDir }).join(' ')}`
                : `${executablePath} ${command}`,
        cpuPercent: 2,
        elapsedSeconds: 60,
        parentPid: 1,
        pid,
        rssBytes: 100_000_000,
    };
}

function createLifecycle(world: FakeWorld) {
    return new ChromeLifecycle({
        cdp: world,
        contract: { executablePath, userDataDir },
        control: world,
        lock: new ProfileLock(path.join(tempRoot, 'profiles', 'agent.lock')),
        processes: world,
        timings: {
            forcedQuitMs: 300,
            gracefulQuitMs: 300,
            pollIntervalMs: 10,
            startTimeoutMs: 500,
        },
    });
}

beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-browser-'));
    userDataDir = path.join(tempRoot, 'profiles', 'agent');
});

afterEach(() => {
    fs.rmSync(tempRoot, { force: true, recursive: true });
});

describe('ChromeLifecycle', () => {
    test('first launch spawns Chrome detached with the managed contract', async () => {
        const world = new FakeWorld();
        const lifecycle = createLifecycle(world);
        await lifecycle.start();

        expect(world.spawned).toHaveLength(1);
        const [spawnedArgs] = world.spawned;
        expect(spawnedArgs?.[0]).toBe(executablePath);
        expect(spawnedArgs).toContain('--remote-debugging-port=0');
        expect(spawnedArgs).toContain(`--user-data-dir=${userDataDir}`);
        expect(spawnedArgs).toContain('--password-store=basic');
        expect(spawnedArgs).toContain('--use-mock-keychain');
        expect(fs.existsSync(userDataDir)).toBe(true);
        expect(fs.existsSync(cookieModeMarkerPath(userDataDir))).toBe(true);
    });

    test('re-adopts an existing managed Chrome instead of launching a second writer', async () => {
        const world = new FakeWorld();
        world.processes = [managedRoot(4100)];
        const lifecycle = createLifecycle(world);
        await lifecycle.start();

        expect(world.spawned).toHaveLength(0);
        const observation = await lifecycle.observe();
        expect(observation).toMatchObject({ pid: 4100, running: true });
    });

    test('refuses to adopt a writer with an incompatible launch contract', async () => {
        const world = new FakeWorld();
        world.processes = [managedRoot(4200, `--user-data-dir=${userDataDir}`)];
        const lifecycle = createLifecycle(world);

        await expect(lifecycle.start()).rejects.toThrow(/incompatible launch contract/);
        expect(world.spawned).toHaveLength(0);
    });

    test('refuses to launch when the recorded cookie mode differs', async () => {
        const world = new FakeWorld();
        fs.mkdirSync(path.dirname(cookieModeMarkerPath(userDataDir)), { recursive: true });
        fs.writeFileSync(
            cookieModeMarkerPath(userDataDir),
            JSON.stringify({ passwordStore: 'keychain', schemaVersion: 1, useMockKeychain: false })
        );
        const lifecycle = createLifecycle(world);

        await expect(lifecycle.start()).rejects.toThrow(/cookie-encryption mode/);
        expect(world.spawned).toHaveLength(0);
    });

    test('stops Chrome gracefully before escalating to SIGKILL', async () => {
        const world = new FakeWorld();
        world.processes = [managedRoot(4300)];
        const lifecycle = createLifecycle(world);
        await lifecycle.stop();
        expect(world.signals).toEqual([{ pid: 4300, signal: 'SIGTERM' }]);

        world.processes = [managedRoot(4301)];
        world.exitOnSigterm = false;
        await lifecycle.stop();
        expect(world.signals.slice(1)).toEqual([
            { pid: 4301, signal: 'SIGTERM' },
            { pid: 4301, signal: 'SIGKILL' },
        ]);
    });

    test('a second lifecycle cannot start while another process holds the profile lock', async () => {
        const lockPath = path.join(tempRoot, 'profiles', 'agent.lock');
        fs.mkdirSync(path.dirname(lockPath), { recursive: true });
        // A pid that exists and is not ours: init.
        fs.writeFileSync(lockPath, '1\n');

        const world = new FakeWorld();
        const lifecycle = createLifecycle(world);
        await expect(lifecycle.start()).rejects.toThrow(/locked by another process/);
        expect(world.spawned).toHaveLength(0);
    });

    test('preserves durable profile contents across stop and restart', async () => {
        const world = new FakeWorld();
        const lifecycle = createLifecycle(world);
        await lifecycle.start();
        const cookieFile = path.join(userDataDir, 'Default-Cookies');
        fs.writeFileSync(cookieFile, 'durable');

        await lifecycle.restart();
        expect(fs.readFileSync(cookieFile, 'utf8')).toBe('durable');
    });
});
