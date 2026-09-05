import {
    type CloudAgentBranch,
    type CloudAgentStatus,
    type CloudAgentUsage,
    cloudAgentActivityMaxLength,
    cloudAgentRepositorySchema,
    cloudAgentSummaryMaxLength,
} from '@grotto/api';
import type { CloudAgentProviderObservation } from '../provider.ts';
import type { CursorBranchReading, CursorRunReading, CursorRunStatus } from './transport.ts';

/**
 * The one place Cursor's Run vocabulary becomes Grotto's. Cursor Agent state
 * (`ACTIVE`/`IDLE`/`ARCHIVED`) never appears here: an idle Agent does not prove
 * a Run finished, so only the Run's own status settles work.
 */
export function cloudAgentStatusOf(rawStatus: CursorRunStatus): CloudAgentStatus {
    switch (rawStatus) {
        case 'QUEUED':
            return 'queued';
        case 'CREATING':
        case 'RUNNING':
            return 'running';
        case 'FINISHED':
            return 'completed';
        case 'ERROR':
            return 'failed';
        case 'CANCELLED':
            return 'cancelled';
        case 'EXPIRED':
            return 'expired';
    }
}

/** Cursor's provider-hosted Agent page, the target of "Open in Cursor". */
export function cursorAgentUrl(agentId: string): string {
    return `https://cursor.com/agents?id=${encodeURIComponent(agentId)}`;
}

/**
 * One Cursor Run reading as a bounded Grotto observation. Everything Server
 * stores is here; prompts, transcripts, tool traces, and the API key are not.
 */
export function observationOf(
    reading: CursorRunReading,
    context: { agentId: string; observedAt: string }
): CloudAgentProviderObservation {
    const summary = boundedSummary(reading);
    const usage = usageOf(reading);
    const branches = branchesOf(reading.branches);
    const errorCode = reading.errorCode ? bounded(collapse(reading.errorCode), 120) : '';
    return {
        ...(branches.length > 0 ? { branches } : {}),
        ...(errorCode ? { errorCode } : {}),
        observedAt: context.observedAt,
        providerAgentId: context.agentId,
        providerRunId: reading.runId,
        providerUrl: cursorAgentUrl(context.agentId),
        rawStatus: reading.rawStatus,
        status: cloudAgentStatusOf(reading.rawStatus),
        ...(summary ? { summary } : {}),
        ...(usage ? { usage } : {}),
    };
}

/** One live line of state while a Run runs. It yields to the Run summary later. */
export function activityOf(summary: string, at: string): { at: string; summary: string } | null {
    const line = bounded(collapse(summary), cloudAgentActivityMaxLength);
    return line ? { at, summary: line } : null;
}

/**
 * Cursor's terminal Run report, retained as evidence. A branch Cursor reports
 * against a repository Grotto cannot name as `owner/name` is dropped rather
 * than reshaped: Grotto stores no branch entity and invents no repository.
 */
export function branchesOf(readings: CursorBranchReading[]): CloudAgentBranch[] {
    const branches: CloudAgentBranch[] = [];
    for (const reading of readings) {
        const repository = repositoryOf(reading.repoUrl);
        const branch = reading.branch ? bounded(reading.branch, 300) : '';
        if (!(repository && branch)) {
            continue;
        }
        branches.push({
            branch,
            pullRequestUrl: reading.prUrl && reading.prUrl.length <= 2000 ? reading.prUrl : null,
            repository,
        });
        if (branches.length === 50) {
            break;
        }
    }
    return branches;
}

/**
 * `owner/name` from a Cursor repository URL. Cursor reports a clone URL; Grotto
 * records the repository the Agent named, in the one shape it records.
 */
export function repositoryOf(repoUrl: string): string | null {
    const path = repoUrl
        .replace(/^[a-z+]+:\/\/[^/]+\//iu, '')
        .replace(/^git@[^:]+:/iu, '')
        .replace(/\.git$/iu, '')
        .replace(/\/+$/u, '');
    const parsed = cloudAgentRepositorySchema.safeParse(path);
    return parsed.success ? parsed.data : null;
}

/**
 * Per-Run tokens and optional cost, exactly as Cursor reports them. Cost is
 * eventually consistent and can lag a terminal Run; it is never a claim about
 * plan capacity, remaining allowance, or reset time.
 */
export function usageOf(reading: CursorRunReading): CloudAgentUsage | null {
    if (!reading.usage) {
        return null;
    }
    const { chargedCents, inputTokens, outputTokens } = reading.usage;
    return {
        costUsd: chargedCents === null ? null : Math.max(0, chargedCents) / 100,
        inputTokens: Math.max(0, Math.trunc(inputTokens)),
        outputTokens: Math.max(0, Math.trunc(outputTokens)),
    };
}

/** The Run's own words: its result when it has one, its error when it failed. */
function boundedSummary(reading: CursorRunReading): string | null {
    const text = reading.result ?? reading.errorMessage;
    return text ? bounded(collapse(text), cloudAgentSummaryMaxLength) : null;
}

function collapse(value: string): string {
    return value.replace(/\s+/gu, ' ').trim();
}

function bounded(value: string, limit: number): string {
    const trimmed = value.trim();
    return trimmed.length > limit ? trimmed.slice(0, limit).trimEnd() : trimmed;
}
