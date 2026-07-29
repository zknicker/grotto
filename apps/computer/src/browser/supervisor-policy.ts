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
