import {
    type CloudAgentProvider,
    type CloudAgentStatus,
    type CloudAgentWork,
    isTerminalCloudAgentStatus,
} from '@grotto/api';

/** The provider name a Cloud Agent work reads under. Cursor is the only one. */
export const cloudAgentProviderLabels: Record<CloudAgentProvider, string> = {
    cursor: 'Cursor',
};

/**
 * How one work reads right now. `cancelling` is not a stored status: a cancel
 * is recorded while the provider Run keeps going, and the surface says so
 * until an observation settles the Run.
 */
export type CloudAgentPresentationStatus = 'cancelling' | CloudAgentStatus;

export type CloudAgentTone = 'accent' | 'danger' | 'muted' | 'success';

/** A running work that has not reported for this long shows its last update. */
export const cloudAgentStaleAfterMs = 10 * 60_000;

export interface CloudAgentWorkPresentationInput {
    activity: CloudAgentWork['activity'];
    cancelRequestedAt: string | null;
    runs: readonly CloudAgentWork['runs'][number][];
    startedAt: string | null;
    status: CloudAgentStatus;
    terminalAt: string | null;
    updatedAt: string;
}

export function cloudAgentPresentationStatus(
    work: Pick<CloudAgentWorkPresentationInput, 'cancelRequestedAt' | 'status'>
): CloudAgentPresentationStatus {
    if (work.cancelRequestedAt && !isTerminalCloudAgentStatus(work.status)) {
        return 'cancelling';
    }
    return work.status;
}

/**
 * The one point of lifecycle color on the surface. A cancelled or cancelling
 * work is muted rather than dangerous: somebody asked for it.
 */
export function cloudAgentStatusTone(status: CloudAgentPresentationStatus): CloudAgentTone {
    switch (status) {
        case 'running':
            return 'accent';
        case 'completed':
            return 'success';
        case 'expired':
        case 'failed':
            return 'danger';
        default:
            return 'muted';
    }
}

/**
 * The trailing status one work reads as. A live work states how long it has
 * been going; a completed one states how long it took, because that is the
 * fact a reader scanning back needs. A failure states only that it failed —
 * the line beneath already carries the provider's own reason.
 */
export function cloudAgentStatusText(work: CloudAgentWorkPresentationInput, now: number): string {
    const status = cloudAgentPresentationStatus(work);

    switch (status) {
        case 'queued':
            return 'Queued';
        case 'cancelling':
            return 'Cancelling';
        case 'running': {
            const elapsed = elapsedSince(work.startedAt, now);
            return elapsed === null ? 'Running' : `Running · ${elapsed}`;
        }
        case 'completed': {
            const duration = spanBetween(work.startedAt, work.terminalAt);
            return duration === null ? 'Done' : `Done · ${duration}`;
        }
        case 'failed':
            return 'Failed';
        case 'expired':
            return 'Expired';
        case 'cancelled':
            return 'Cancelled';
    }
}

/**
 * The one muted line beneath the header: what the work is doing while it runs,
 * and what its latest Run reported once it settles. `activity` yields to that
 * report rather than freezing mid-sentence on a finished work.
 */
export function cloudAgentWorkDetailLine(work: CloudAgentWorkPresentationInput): null | string {
    if (isTerminalCloudAgentStatus(work.status)) {
        const latest = work.runs.at(0);
        return latest?.summary ?? latest?.errorCode ?? null;
    }
    return work.activity?.summary ?? null;
}

/**
 * A running work that has gone quiet. This reads from the work's own
 * `updatedAt` rather than from Computer connection state: the reader cares
 * that nothing has been reported, not why.
 */
export function isCloudAgentWorkStale(
    work: Pick<CloudAgentWorkPresentationInput, 'status' | 'updatedAt'>,
    now: number
): boolean {
    if (work.status !== 'running') {
        return false;
    }
    const updatedAt = Date.parse(work.updatedAt);
    return Number.isFinite(updatedAt) && now - updatedAt > cloudAgentStaleAfterMs;
}

/** Owners and Admins may cancel; a settled Run has nothing left to stop. */
export function canCancelCloudAgentWork(input: {
    cancelRequestedAt: string | null;
    role: string;
    status: CloudAgentStatus;
}): boolean {
    return (
        (input.role === 'owner' || input.role === 'admin') &&
        !isTerminalCloudAgentStatus(input.status) &&
        input.cancelRequestedAt === null
    );
}

/** Coarse by design: a work surface states minutes, not a stopwatch. */
export function formatCloudAgentDuration(durationMs: number): string {
    const seconds = Math.max(0, Math.floor(durationMs / 1000));

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function elapsedSince(startedAt: null | string, now: number): null | string {
    const started = startedAt === null ? Number.NaN : Date.parse(startedAt);
    if (!Number.isFinite(started)) {
        return null;
    }
    return formatCloudAgentDuration(Math.max(0, now - started));
}

export function spanBetween(startedAt: null | string, terminalAt: null | string): null | string {
    const started = startedAt === null ? Number.NaN : Date.parse(startedAt);
    const ended = terminalAt === null ? Number.NaN : Date.parse(terminalAt);
    if (!(Number.isFinite(started) && Number.isFinite(ended))) {
        return null;
    }
    return formatCloudAgentDuration(Math.max(0, ended - started));
}
