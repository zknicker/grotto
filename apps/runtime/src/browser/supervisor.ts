import type { AgentRuntimeBrowserState, AgentRuntimeBrowserStatus } from '@tavern/api';

import { log } from '../log.ts';
import type { BrowserCommandQueue } from './command-queue.ts';
import type { BrowserClock, BrowserLifecycleControl, BrowserObservation } from './types.ts';
import { systemBrowserClock } from './types.ts';

export interface BrowserSupervisorPolicy {
    cdpFailureWindowMs: number;
    commandDrainTimeoutMs: number;
    pressureGpuCpuPercent: number;
    pressureWindowMs: number;
    restartBudgetLimit: number;
    restartBudgetWindowMs: number;
    sampleIntervalMs: number;
}

export const defaultBrowserSupervisorPolicy: BrowserSupervisorPolicy = {
    cdpFailureWindowMs: 60_000,
    commandDrainTimeoutMs: 60_000,
    pressureGpuCpuPercent: 90,
    pressureWindowMs: 60_000,
    restartBudgetLimit: 2,
    restartBudgetWindowMs: 3_600_000,
    sampleIntervalMs: 15_000,
};

interface RecoveryEvidence {
    at: number;
    observation: BrowserObservation;
    reason: string;
}

const maxRecoveryEvidence = 20;

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
    private readonly recoveryEvidence: RecoveryEvidence[] = [];

    constructor(options: BrowserSupervisorOptions) {
        this.lifecycle = options.lifecycle;
        this.commandQueue = options.commandQueue;
        this.clock = options.clock ?? systemBrowserClock;
        this.policy = { ...defaultBrowserSupervisorPolicy, ...options.policy };
        this.browserVersion = options.browserVersion;
        this.onStatusChanged = options.onStatusChanged;
    }

    // Starting the supervisor never blocks or fails Runtime startup: a failed
    // launch surfaces through status and capability health instead.
    async start(): Promise<void> {
        this.monitorTimer ??= setInterval(() => {
            void this.sample();
        }, this.policy.sampleIntervalMs);
        try {
            await this.startBrowser();
        } catch (error) {
            log.warn('browser: managed Chrome did not start', { err: error });
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

    // Operator-initiated restart: waits for active commands, does not spend
    // the automatic restart budget.
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
            log.warn('browser: supervision sample failed', { err: error });
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
            log.warn('browser: recovery deferred while a browser command is running');
            return;
        }

        this.recoveryRunning = true;
        this.automaticRestarts.push(this.clock.now());
        await this.captureEvidence(reason);
        log.warn('browser: starting guarded recovery', { reason });
        try {
            await this.lifecycle.restart();
            await this.verifyAfterRestart();
            this.recoveryFailure = null;
            this.cdpFailureSince = null;
            log.info('browser: guarded recovery succeeded');
        } catch (error) {
            this.recoveryFailure = `Browser recovery failed: ${
                error instanceof Error ? error.message : String(error)
            }`;
            log.error('browser: guarded recovery failed', { err: error });
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
            if (this.recoveryEvidence.length > maxRecoveryEvidence) {
                this.recoveryEvidence.splice(0, this.recoveryEvidence.length - maxRecoveryEvidence);
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
