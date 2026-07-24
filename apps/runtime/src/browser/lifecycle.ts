import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { SystemCdpProber } from './cdp-probe.ts';
import {
    isCompatibleManagedRoot,
    locateManagedChrome,
    SystemProcessList,
} from './chrome-processes.ts';
import {
    type BrowserLaunchContract,
    buildLaunchArguments,
    hasManagedLaunchContract,
    verifyCookieModeMarker,
} from './launch-contract.ts';
import type { ProfileLock } from './profile-lock.ts';
import type {
    BrowserObservation,
    CdpAttachment,
    CdpProber,
    ChromeProcessControl,
    ManagedChromeMatch,
    ProcessListReader,
} from './types.ts';
import { stoppedBrowserObservation } from './types.ts';

export interface ChromeLifecycleTimings {
    forcedQuitMs: number;
    gracefulQuitMs: number;
    pollIntervalMs: number;
    startTimeoutMs: number;
}

export const defaultChromeLifecycleTimings: ChromeLifecycleTimings = {
    forcedQuitMs: 10_000,
    gracefulQuitMs: 10_000,
    pollIntervalMs: 250,
    startTimeoutMs: 15_000,
};

export interface ChromeLifecycleOptions {
    cdp?: CdpProber;
    contract: BrowserLaunchContract;
    control?: ChromeProcessControl;
    lock: ProfileLock;
    processes?: ProcessListReader;
    timings?: Partial<ChromeLifecycleTimings>;
}

const systemProcessControl: ChromeProcessControl = {
    isAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    },
    signal(pid, signal) {
        try {
            process.kill(pid, signal);
        } catch {
            // An already-exited process needs no signal.
        }
    },
    spawnDetached(executablePath, args) {
        // Chrome is launched detached from Runtime: Runtime shutdown or
        // upgrade leaves the browser (and its logins) running.
        const child = spawn(executablePath, args, {
            detached: true,
            stdio: 'ignore',
        });
        child.unref();
        if (child.pid === undefined) {
            throw new Error('Chrome launch did not produce a process id.');
        }
        return child.pid;
    },
};

// Owns one managed Chrome root process: adopt-or-launch, bounded graceful
// shutdown, and observation. Ported from the proven BrowserHost lifecycle.
export class ChromeLifecycle {
    private readonly contract: BrowserLaunchContract;
    private readonly lock: ProfileLock;
    private readonly processes: ProcessListReader;
    private readonly cdp: CdpProber;
    private readonly control: ChromeProcessControl;
    private readonly timings: ChromeLifecycleTimings;

    constructor(options: ChromeLifecycleOptions) {
        this.contract = options.contract;
        this.lock = options.lock;
        this.processes = options.processes ?? new SystemProcessList();
        this.cdp = options.cdp ?? new SystemCdpProber();
        this.control = options.control ?? systemProcessControl;
        this.timings = { ...defaultChromeLifecycleTimings, ...options.timings };
    }

    async start(): Promise<void> {
        this.lock.acquire();
        const markerCheck = verifyCookieModeMarker(this.contract.userDataDir);
        if (markerCheck.reason) {
            throw new Error(markerCheck.reason);
        }

        const existing = await this.currentMatch();
        if (existing) {
            if (!hasManagedLaunchContract(existing.root.command, this.contract)) {
                throw new Error(
                    'A Chrome process is already writing this profile with an incompatible launch contract.'
                );
            }
            if ((await this.cdp.probe(this.contract.userDataDir)).state !== 'healthy') {
                throw new Error('Existing managed Chrome did not respond over CDP.');
            }
            return;
        }

        fs.mkdirSync(this.contract.userDataDir, { mode: 0o700, recursive: true });
        this.control.spawnDetached(
            this.contract.executablePath,
            buildLaunchArguments(this.contract)
        );

        const deadline = Date.now() + this.timings.startTimeoutMs;
        while (Date.now() < deadline) {
            const match = await this.currentMatch();
            if (
                match &&
                hasManagedLaunchContract(match.root.command, this.contract) &&
                (await this.cdp.probe(this.contract.userDataDir)).state === 'healthy'
            ) {
                return;
            }
            await sleep(this.timings.pollIntervalMs);
        }
        throw new Error('Chrome did not become healthy within the start timeout.');
    }

    async stop(): Promise<void> {
        this.lock.acquire();
        const match = await this.currentMatch();
        if (!match) {
            return;
        }
        if (!isCompatibleManagedRoot(match, this.contract)) {
            throw new Error(
                'A Chrome process with an incompatible launch contract owns this profile; refusing to stop it.'
            );
        }

        this.control.signal(match.root.pid, 'SIGTERM');
        if (await this.waitForExit(match.root.pid, this.timings.gracefulQuitMs)) {
            return;
        }
        this.control.signal(match.root.pid, 'SIGKILL');
        if (!(await this.waitForExit(match.root.pid, this.timings.forcedQuitMs))) {
            throw new Error(`Chrome (pid ${match.root.pid}) did not exit after SIGKILL.`);
        }
    }

    async restart(): Promise<void> {
        await this.stop();
        await this.start();
    }

    attachment(): Promise<CdpAttachment> {
        return this.cdp.attachment(this.contract.userDataDir);
    }

    async observe(): Promise<BrowserObservation> {
        const match = await this.currentMatch();
        if (!match) {
            return stoppedBrowserObservation;
        }
        return {
            cdp: await this.cdp.probe(this.contract.userDataDir),
            contractCompatible: isCompatibleManagedRoot(match, this.contract),
            lockHeld: this.lock.isHeld,
            pid: match.root.pid,
            resources: {
                browserCpuPercent: match.root.cpuPercent,
                browserRssBytes: match.root.rssBytes,
                gpuCpuPercent: match.gpu?.cpuPercent ?? null,
                gpuRssBytes: match.gpu?.rssBytes ?? null,
            },
            running: true,
            uptimeSeconds: match.root.elapsedSeconds,
        };
    }

    private async currentMatch(): Promise<ManagedChromeMatch | null> {
        return locateManagedChrome(await this.processes.read(), this.contract);
    }

    private async waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
        const deadline = Date.now() + Math.max(200, timeoutMs);
        while (Date.now() < deadline) {
            if (!this.control.isAlive(pid)) {
                return true;
            }
            await sleep(Math.min(200, this.timings.pollIntervalMs));
        }
        return !this.control.isAlive(pid);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
