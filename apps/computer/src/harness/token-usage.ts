import type { AgentSessionTokenUsage } from './session-store.ts';

export type HarnessTokenUsage = AgentSessionTokenUsage;

export function usageContextTokens(usage: unknown): number | null {
    if (!isRecord(usage)) {
        return null;
    }
    const inputTotal = tokenCount(usage.inputTokens);
    const outputTotal = tokenCount(usage.outputTokens);
    if (inputTotal === null && outputTotal === null) {
        return null;
    }
    return (inputTotal ?? 0) + (outputTotal ?? 0);
}

export function readTokenUsage(usage: unknown): HarnessTokenUsage | null {
    if (!isRecord(usage)) {
        return null;
    }
    const details = isRecord(usage.inputTokenDetails) ? usage.inputTokenDetails : null;
    const inputTokens = tokenCount(usage.inputTokens);
    const outputTokens = tokenCount(usage.outputTokens);
    const cacheReadTokens = tokenCount(details?.cacheReadTokens);
    const cacheWriteTokens = tokenCount(details?.cacheWriteTokens);
    if ([inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].every((v) => v === null)) {
        return null;
    }
    return {
        cacheReadTokens: cacheReadTokens ?? 0,
        cacheWriteTokens: cacheWriteTokens ?? 0,
        inputTokens: inputTokens ?? 0,
        outputTokens: outputTokens ?? 0,
        totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
    };
}

export function addTokenUsage(
    current: HarnessTokenUsage | null,
    next: HarnessTokenUsage | null
): HarnessTokenUsage | null {
    if (!(current && next)) {
        return next ?? current;
    }
    return {
        cacheReadTokens: current.cacheReadTokens + next.cacheReadTokens,
        cacheWriteTokens: current.cacheWriteTokens + next.cacheWriteTokens,
        inputTokens: current.inputTokens + next.inputTokens,
        outputTokens: current.outputTokens + next.outputTokens,
        totalTokens: current.totalTokens + next.totalTokens,
    };
}

export function normalizeRuntimeUsage(
    runtimeId: string,
    observed: HarnessTokenUsage | null,
    previous: HarnessTokenUsage | null
): { cumulative: HarnessTokenUsage | null; turn: HarnessTokenUsage | null } {
    if (runtimeId !== 'codex' || observed === null) {
        return { cumulative: previous, turn: observed };
    }
    if (previous === null) {
        return { cumulative: observed, turn: null };
    }
    if (tokenFields.some((field) => observed[field] < previous[field])) {
        return { cumulative: observed, turn: observed };
    }
    const turn = emptyTokenUsage();
    for (const field of tokenFields) {
        turn[field] = observed[field] - previous[field];
    }
    turn.totalTokens = turn.inputTokens + turn.outputTokens;
    return { cumulative: observed, turn };
}

const tokenFields = ['cacheReadTokens', 'cacheWriteTokens', 'inputTokens', 'outputTokens'] as const;

function emptyTokenUsage(): HarnessTokenUsage {
    return {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
    };
}

function tokenCount(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
