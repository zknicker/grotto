import type { AgentRuntimeBrowserState, AgentRuntimeBrowserStatus } from '@tavern/api';

import type { BrowserCommandQueue } from './command-queue.ts';
import {
    type BrowserRecoveryEvidence,
    type BrowserSupervisorPolicy,
    defaultBrowserSupervisorPolicy,
    maxBrowserRecoveryEvidence,
} from './supervisor-policy.ts';
import type { BrowserClock, BrowserLifecycleControl, BrowserObservation } from './types.ts';
import { systemBrowserClock } from './types.ts';

export interface BrowserSupervisorOptions {
    browserVersion: string | null;
    clock?: BrowserClock;
    commandQueue: BrowserCommandQueue;
    lifecycle: BrowserLifecycleControl;
    onStatusChanged?: (state: AgentRuntimeBrowserState) => void;
    policy?: Partial<BrowserSupervisorPolicy>;
}

// The seven-state supervision model proven in BrowserHost: stopped, starting,
// healthy, pressured, unresponsive, recovering, and degraded. Pressure is
// reported but never independently restarts Chrome; automatic recovery
// requires sustained CDP unresponsiveness and respects a restart budget.
export class BrowserSupervisor {
    private readonly lifecycle: BrowserLifecycleControl;
    private readonly commandQueue: BrowserCommandQueue;
    private readonly clock: BrowserClock;
    private readonly policy: BrowserSupervisorPolicy;
    private readonly browserVersion: string | null;
    private readonly onStatusChanged?: (state: AgentRuntimeBrowserState) => void;

    private monitorTimer: ReturnType<typeof setInterval> | null = null;
    private pressureSince: number | null = null;
    private cdpFailureSince: number | null = null;
    private automaticRestarts: number[] = [];
    private recoveryRunning = false;
    private recoveryFailure: string | null = null;
    private lastState: AgentRuntimeBrowserState | null = null;
    private readonly recoveryEvidence: BrowserRecoveryEvidence[] = [];

    constructor(options: BrowserSupervisorOptions) {
        this.lifecycle = options.lifecycle;
        this.commandQueue = options.commandQueue;
        this.clock = options.clock ?? systemBrowserClock;
        this.policy = { ...defaultBrowserSupervisorPolicy, ...options.policy };
        this.browserVersion = options.browserVersion;
        this.onStatusChanged = options.onStatusChanged;
    }

    async start(): Promise<void> {
        this.monitorTimer ??= setInterval(() => {
            void this.sample();
        }, this.policy.sampleIntervalMs);
        try {
            await this.startBrowser();
        } catch (error) {
            console.warn('browser: managed Chrome did not start', error);
        }
    }

    stop(): void {
        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
        }
    }

    async startBrowser(): Promise<void> {
        await this.lifecycle.start();
        this.recoveryFailure = null;
        this.cdpFailureSince = null;
        await this.status();
    }

    async restartBrowser(): Promise<void> {
        if (this.recoveryRunning) {
            throw new Error('Browser recovery is already running.');
        }
        await this.commandQueue.waitForDrain(this.policy.commandDrainTimeoutMs);
        this.recoveryRunning = true;
        try {
            await this.lifecycle.restart();
            await this.verifyAfterRestart();
            this.recoveryFailure = null;
            this.cdpFailureSince = null;
        } finally {
            this.recoveryRunning = false;
        }
        await this.status();
    }

    async status(): Promise<AgentRuntimeBrowserStatus> {
        const now = this.clock.now();
        let observation: BrowserObservation;
        let evaluated: { reason: string | null; state: AgentRuntimeBrowserState };
        try {
            observation = await this.lifecycle.observe();
            evaluated = this.recoveryRunning
                ? { reason: 'Browser recovery is running.', state: 'recovering' }
                : this.evaluate(observation, now);
        } catch (error) {
            observation = {
                cdp: { latencyMs: null, state: 'unknown' },
                contractCompatible: true,
                lockHeld: false,
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
            evaluated = {
                reason: `Browser observation failed: ${error instanceof Error ? error.message : String(error)}`,
                state: 'degraded',
            };
        }

        if (this.lastState !== evaluated.state) {
            this.lastState = evaluated.state;
            this.onStatusChanged?.(evaluated.state);
        }

        return {
            browserVersion: this.browserVersion,
            cdpState: observation.cdp.state,
            checkedAt: new Date(now).toISOString(),
            pid: observation.pid,
            pressureSince: this.pressureSince ? new Date(this.pressureSince).toISOString() : null,
            reason: evaluated.reason,
            resources: observation.resources,
            restartBudget: {
                automaticRestartLimit: this.policy.restartBudgetLimit,
                automaticRestartsInWindow: this.automaticRestartsInWindow(now),
            },
            running: observation.running,
            state: evaluated.state,
            uptimeSeconds: observation.uptimeSeconds,
        };
    }

    private evaluate(
        observation: BrowserObservation,
        now: number
    ): { reason: string | null; state: AgentRuntimeBrowserState } {
        if (!observation.running) {
            this.pressureSince = null;
            this.cdpFailureSince = null;
            // A failed recovery that left Chrome dead needs operator action;
            // an intentionally stopped browser does not.
            if (this.recoveryFailure) {
                return { reason: this.recoveryFailure, state: 'degraded' };
            }
            return { reason: 'Chrome is not running.', state: 'stopped' };
        }

        if (!observation.contractCompatible) {
            return {
                reason: 'Chrome is writing this profile with an incompatible launch contract.',
                state: 'degraded',
            };
        }
        if (!observation.lockHeld) {
            return {
                reason: 'Chrome is running without the Grotto profile lock.',
                state: 'degraded',
            };
        }

        const pressured =
            (observation.resources.gpuCpuPercent ?? 0) >= this.policy.pressureGpuCpuPercent;
        this.pressureSince = pressured ? (this.pressureSince ?? now) : null;
        const sustainedPressure =
            this.pressureSince !== null && now - this.pressureSince >= this.policy.pressureWindowMs;

        const cdpFailed = observation.cdp.state !== 'healthy';
        this.cdpFailureSince = cdpFailed ? (this.cdpFailureSince ?? now) : null;
        const sustainedCdpFailure =
            this.cdpFailureSince !== null &&
            now - this.cdpFailureSince >= this.policy.cdpFailureWindowMs;

        if (sustainedCdpFailure) {
            if (this.automaticRestartsInWindow(now) >= this.policy.restartBudgetLimit) {
                return {
                    reason: 'Chrome is unresponsive and the automatic restart budget is exhausted. Restart the browser from settings.',
                    state: 'degraded',
                };
            }
            return {
                reason: 'Chrome is alive but CDP has remained unreachable.',
                state: 'unresponsive',
            };
        }
        if (sustainedPressure) {
            return {
                reason: 'Chrome remains responsive under sustained GPU pressure.',
                state: 'pressured',
            };
        }
        if (cdpFailed) {
            return {
                reason: 'Chrome CDP is temporarily unreachable within the evidence window.',
                state: 'starting',
            };
        }
        // A responsive browser under the contract clears any stale recovery
        // failure: the failed attempt is no longer evidence.
        this.recoveryFailure = null;
        return { reason: null, state: 'healthy' };
    }

    // One supervision cycle: evaluate health, then recover when the evidence
    // window and every guard allow it. Driven by the monitor interval.
    async sample(): Promise<void> {
        try {
            const status = await this.status();
            if (status.state === 'unresponsive') {
                await this.recoverAutomatically(status.reason ?? 'Sustained CDP failure.');
            }
        } catch (error) {
            console.warn('browser: supervision sample failed', error);
        }
    }

    private async recoverAutomatically(reason: string): Promise<void> {
        if (this.recoveryRunning) {
            return;
        }
        const now = this.clock.now();
        if (this.automaticRestartsInWindow(now) >= this.policy.restartBudgetLimit) {
            return;
        }
        // An active browser command inhibits recovery; wait a bounded period
        // for the queue to drain and try again on a later sample if it stays
        // busy.
        if (!(await this.commandQueue.waitForDrain(this.policy.commandDrainTimeoutMs))) {
            console.warn('browser: recovery deferred while a browser command is running');
            return;
        }

        this.recoveryRunning = true;
        this.automaticRestarts.push(this.clock.now());
        await this.captureEvidence(reason);
        console.warn('browser: starting guarded recovery', reason);
        try {
            await this.lifecycle.restart();
            await this.verifyAfterRestart();
            this.recoveryFailure = null;
            this.cdpFailureSince = null;
            console.info('browser: guarded recovery succeeded');
        } catch (error) {
            this.recoveryFailure = `Browser recovery failed: ${
                error instanceof Error ? error.message : String(error)
            }`;
            console.error('browser: guarded recovery failed', error);
        } finally {
            this.recoveryRunning = false;
        }
        await this.status();
    }

    private async verifyAfterRestart(): Promise<void> {
        const observation = await this.lifecycle.observe();
        const verified =
            observation.running &&
            observation.contractCompatible &&
            observation.lockHeld &&
            observation.cdp.state === 'healthy';
        if (!verified) {
            throw new Error('Chrome restarted but failed profile/CDP verification.');
        }
    }

    private async captureEvidence(reason: string): Promise<void> {
        try {
            const observation = await this.lifecycle.observe();
            this.recoveryEvidence.push({ at: this.clock.now(), observation, reason });
            if (this.recoveryEvidence.length > maxBrowserRecoveryEvidence) {
                this.recoveryEvidence.splice(
                    0,
                    this.recoveryEvidence.length - maxBrowserRecoveryEvidence
                );
            }
        } catch {
            // Evidence capture must never block recovery.
        }
    }

    private automaticRestartsInWindow(now: number): number {
        this.automaticRestarts = this.automaticRestarts.filter(
            (at) => now - at < this.policy.restartBudgetWindowMs
        );
        return this.automaticRestarts.length;
    }
}
