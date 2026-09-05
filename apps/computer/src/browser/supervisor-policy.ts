import type { AgentRuntimeBrowserState } from '@grotto/api';
import type { BrowserObservation } from './types.ts';

export interface BrowserRecoveryEvidence {
    at: number;
    observation: BrowserObservation;
    reason: string;
}

export const maxBrowserRecoveryEvidence = 20;

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

export interface SupervisionEvidence {
    automaticRestarts: readonly number[];
    cdpFailureSince: number | null;
    lastPublishedState: AgentRuntimeBrowserState | null;
    pressureSince: number | null;
    recoveryEvidence: readonly BrowserRecoveryEvidence[];
    recoveryFailure: string | null;
}

export interface HealthEvaluation {
    evidence: SupervisionEvidence;
    reason: string | null;
    state: AgentRuntimeBrowserState;
}

export function initialSupervisionEvidence(): SupervisionEvidence {
    return {
        automaticRestarts: [],
        cdpFailureSince: null,
        lastPublishedState: null,
        pressureSince: null,
        recoveryEvidence: [],
        recoveryFailure: null,
    };
}

export function evaluateBrowserHealth(input: {
    evidence: SupervisionEvidence;
    now: number;
    observation: BrowserObservation;
    policy: BrowserSupervisorPolicy;
}): HealthEvaluation {
    const automaticRestarts = pruneAutomaticRestarts(input);
    const evidence = { ...input.evidence, automaticRestarts };
    if (!input.observation.running) {
        const stoppedEvidence = { ...evidence, cdpFailureSince: null, pressureSince: null };
        return input.evidence.recoveryFailure
            ? {
                  evidence: stoppedEvidence,
                  reason: input.evidence.recoveryFailure,
                  state: 'degraded',
              }
            : { evidence: stoppedEvidence, reason: 'Chrome is not running.', state: 'stopped' };
    }
    if (!input.observation.contractCompatible) {
        return {
            evidence,
            reason: 'Chrome is writing this profile with an incompatible launch contract.',
            state: 'degraded',
        };
    }
    if (!input.observation.lockHeld) {
        return {
            evidence,
            reason: 'Chrome is running without the Grotto profile lock.',
            state: 'degraded',
        };
    }

    const pressured =
        (input.observation.resources.gpuCpuPercent ?? 0) >= input.policy.pressureGpuCpuPercent;
    const pressureSince = pressured ? (evidence.pressureSince ?? input.now) : null;
    const cdpFailed = input.observation.cdp.state !== 'healthy';
    const cdpFailureSince = cdpFailed ? (evidence.cdpFailureSince ?? input.now) : null;
    const next = { ...evidence, cdpFailureSince, pressureSince };

    if (
        cdpFailureSince !== null &&
        input.now - cdpFailureSince >= input.policy.cdpFailureWindowMs
    ) {
        return automaticRestarts.length >= input.policy.restartBudgetLimit
            ? {
                  evidence: next,
                  reason: 'Chrome is unresponsive and the automatic restart budget is exhausted. Restart the browser from settings.',
                  state: 'degraded',
              }
            : {
                  evidence: next,
                  reason: 'Chrome is alive but CDP has remained unreachable.',
                  state: 'unresponsive',
              };
    }
    if (pressureSince !== null && input.now - pressureSince >= input.policy.pressureWindowMs) {
        return {
            evidence: next,
            reason: 'Chrome remains responsive under sustained GPU pressure.',
            state: 'pressured',
        };
    }
    if (cdpFailed) {
        return {
            evidence: next,
            reason: 'Chrome CDP is temporarily unreachable within the evidence window.',
            state: 'starting',
        };
    }
    return { evidence: { ...next, recoveryFailure: null }, reason: null, state: 'healthy' };
}

export function pruneAutomaticRestarts(input: {
    evidence: SupervisionEvidence;
    now: number;
    policy: BrowserSupervisorPolicy;
}): readonly number[] {
    return input.evidence.automaticRestarts.filter(
        (at) => input.now - at < input.policy.restartBudgetWindowMs
    );
}

export function appendRecoveryEvidence(
    evidence: readonly BrowserRecoveryEvidence[],
    entry: BrowserRecoveryEvidence
): readonly BrowserRecoveryEvidence[] {
    return [...evidence, entry].slice(-maxBrowserRecoveryEvidence);
}
