import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readDevToolsActivePort, SystemCdpProber } from './cdp-probe.ts';
import { BrowserCommandQueue } from './command-queue.ts';
import {
    buildLaunchArguments,
    hasManagedLaunchContract,
    isProfileCompatible,
    verifyCookieModeMarker,
} from './launch-contract.ts';
import { ProfileLock } from './profile-lock.ts';

let tempRoot: string;

beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-browser-'));
});

afterEach(() => {
    fs.rmSync(tempRoot, { force: true, recursive: true });
});

describe('launch contract', () => {
    const contract = {
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        userDataDir: '/Users/op/.tavern/browser/profiles/agent',
    };

    test('pins identity-affecting flags in the launch arguments', () => {
        const args = buildLaunchArguments(contract);
        expect(args).toContain('--remote-debugging-port=0');
        expect(args).toContain('--password-store=basic');
        expect(args).toContain('--use-mock-keychain');
        expect(args).toContain('--disable-skia-graphite');
        expect(args).toContain(`--user-data-dir=${contract.userDataDir}`);
        expect(args).not.toContain('--disable-gpu');
    });

    test('the full launch command satisfies its own contract fingerprints', () => {
        const command = `${contract.executablePath} ${buildLaunchArguments(contract).join(' ')}`;
        expect(isProfileCompatible(command, contract)).toBe(true);
        expect(hasManagedLaunchContract(command, contract)).toBe(true);
    });

    test('a partial flag set is profile-compatible but not adoptable', () => {
        const command = `${contract.executablePath} --remote-debugging-port=0 --password-store=basic --use-mock-keychain --user-data-dir=${contract.userDataDir}`;
        expect(isProfileCompatible(command, contract)).toBe(true);
        expect(hasManagedLaunchContract(command, contract)).toBe(false);
    });

    test('records the cookie mode on first use and accepts it afterwards', () => {
        const userDataDir = path.join(tempRoot, 'profiles', 'agent');
        expect(verifyCookieModeMarker(userDataDir)).toEqual({ reason: null });
        expect(verifyCookieModeMarker(userDataDir)).toEqual({ reason: null });
    });

    test('refuses a launch when the recorded cookie mode differs', () => {
        const userDataDir = path.join(tempRoot, 'profiles', 'agent');
        fs.mkdirSync(path.dirname(userDataDir), { recursive: true });
        fs.writeFileSync(
            `${userDataDir}.mode.json`,
            JSON.stringify({ passwordStore: 'keychain', schemaVersion: 1, useMockKeychain: true })
        );
        expect(verifyCookieModeMarker(userDataDir).reason).toContain('cookie-encryption mode');
    });
});

describe('DevToolsActivePort discovery', () => {
    test('reads the OS-selected port and websocket path', () => {
        const userDataDir = path.join(tempRoot, 'profile');
        fs.mkdirSync(userDataDir, { recursive: true });
        fs.writeFileSync(
            path.join(userDataDir, 'DevToolsActivePort'),
            '54321\ndevtools/browser/abc'
        );
        expect(readDevToolsActivePort(userDataDir)).toEqual({
            port: 54_321,
            webSocketPath: '/devtools/browser/abc',
        });
    });

    test('returns null for a missing or malformed file', () => {
        const userDataDir = path.join(tempRoot, 'profile');
        fs.mkdirSync(userDataDir, { recursive: true });
        expect(readDevToolsActivePort(userDataDir)).toBeNull();
        fs.writeFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'not-a-port\n');
        expect(readDevToolsActivePort(userDataDir)).toBeNull();
    });

    test('probes a live CDP endpoint through the discovered port', async () => {
        const server = Bun.serve({
            fetch(request) {
                if (new URL(request.url).pathname === '/json/version') {
                    return Response.json({ Browser: 'Chrome/149.0.0.0' });
                }
                return new Response('not found', { status: 404 });
            },
            port: 0,
        });
        const userDataDir = path.join(tempRoot, 'profile');
        fs.mkdirSync(userDataDir, { recursive: true });
        fs.writeFileSync(
            path.join(userDataDir, 'DevToolsActivePort'),
            `${server.port}\ndevtools/browser/abc`
        );

        const prober = new SystemCdpProber();
        const snapshot = await prober.probe(userDataDir);
        expect(snapshot.state).toBe('healthy');
        const attachment = await prober.attachment(userDataDir);
        expect(attachment.port).toBe(server.port);
        expect(attachment.webSocketDebuggerUrl).toContain('/devtools/browser/abc');
        server.stop();
    });

    test('reports unreachable when nothing listens on the recorded port', async () => {
        const userDataDir = path.join(tempRoot, 'profile');
        fs.mkdirSync(userDataDir, { recursive: true });
        fs.writeFileSync(path.join(userDataDir, 'DevToolsActivePort'), '1\ndevtools/browser/abc');
        expect((await new SystemCdpProber().probe(userDataDir)).state).toBe('unreachable');
    });
});

describe('ProfileLock', () => {
    test('acquires, reports, and releases ownership', () => {
        const lock = new ProfileLock(path.join(tempRoot, 'agent.lock'));
        expect(lock.isHeld).toBe(false);
        lock.acquire();
        expect(lock.isHeld).toBe(true);
        lock.release();
        expect(lock.isHeld).toBe(false);
        expect(fs.existsSync(path.join(tempRoot, 'agent.lock'))).toBe(false);
    });

    test('refuses a profile owned by a live process', () => {
        const lockPath = path.join(tempRoot, 'agent.lock');
        fs.writeFileSync(lockPath, '1\n');
        expect(() => new ProfileLock(lockPath).acquire()).toThrow(/locked by another process/);
    });

    test('reclaims a stale lock left by a dead process', () => {
        const lockPath = path.join(tempRoot, 'agent.lock');
        fs.writeFileSync(lockPath, '999999\n');
        const lock = new ProfileLock(lockPath);
        lock.acquire();
        expect(lock.isHeld).toBe(true);
    });
});

describe('BrowserCommandQueue', () => {
    test('serializes commands in FIFO order', async () => {
        const queue = new BrowserCommandQueue();
        const order: number[] = [];
        const first = queue.run(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            order.push(1);
        });
        const second = queue.run(() => {
            order.push(2);
            return Promise.resolve();
        });
        const third = queue.run(() => {
            order.push(3);
            return Promise.resolve();
        });
        await Promise.all([first, second, third]);
        expect(order).toEqual([1, 2, 3]);
    });

    test('keeps serving after a failed command', async () => {
        const queue = new BrowserCommandQueue();
        await expect(queue.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
        await expect(queue.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
        expect(queue.inFlightCount).toBe(0);
    });

    test('waitForDrain resolves once active commands finish', async () => {
        const queue = new BrowserCommandQueue();
        let release: () => void = () => undefined;
        const command = queue.run(
            () =>
                new Promise<void>((resolve) => {
                    release = resolve;
                })
        );
        expect(await queue.waitForDrain(10)).toBe(false);
        const drained = queue.waitForDrain(1000);
        release();
        await command;
        expect(await drained).toBe(true);
    });
});
