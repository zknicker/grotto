import {
    type CloudAgentBranch,
    type CloudAgentStatus,
    type CloudAgentWork,
    cloudAgentPullRequestNumber,
    isTerminalCloudAgentStatus,
} from '@grotto/api';
import { messagePreviewLine } from '../chats/message-preview-line.ts';

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
 * The one muted line beneath the header: what the work is doing right now. A
 * settled work says nothing here — its own card states the branch, the pull
 * request, and the diff, and a provider's Run prose repeated at Chat scale
 * only crowded those facts out.
 *
 * A provider writes `activity` as Markdown, so it collapses to one flat line
 * here rather than at each surface that shows it.
 */
export function cloudAgentWorkActivityLine(work: CloudAgentWorkPresentationInput): null | string {
    if (isTerminalCloudAgentStatus(work.status)) {
        return null;
    }
    return oneLine(work.activity?.summary ?? null);
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

/**
 * The branch evidence one work has produced, from its newest Run. A provider
 * may report several branches; the one that opened a pull request is the one a
 * human wants, so it wins over the rest and the first reported branch stands in
 * when none has.
 */
export function cloudAgentWorkBranch(
    work: Pick<CloudAgentWorkPresentationInput, 'runs'>
): CloudAgentBranch | null {
    const branches = work.runs.at(0)?.branches ?? [];
    return branches.find((branch) => branch.pullRequestUrl !== null) ?? branches.at(0) ?? null;
}

/**
 * The pull request number one branch names. The Computer's own GitHub reading
 * is authoritative when it exists; otherwise the provider's URL is parsed, so
 * a branch observed before any snapshot still says `PR #482` rather than print
 * a URL. An unrecognised URL keeps its link and loses only the number.
 */
export function cloudAgentBranchPullRequestNumber(branch: CloudAgentBranch): null | number {
    if (branch.pullRequest) {
        return branch.pullRequest.number;
    }
    return branch.pullRequestUrl === null
        ? null
        : cloudAgentPullRequestNumber(branch.pullRequestUrl);
}

/** The Chip color the card's status wears, from the one tone rule above. */
export function cloudAgentStatusChipColor(
    status: CloudAgentPresentationStatus
): 'accent' | 'danger' | 'default' | 'success' {
    const tone = cloudAgentStatusTone(status);
    return tone === 'muted' ? 'default' : tone;
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

/** Markdown a provider wrote, as the one muted line a surface can show. */
function oneLine(text: null | string): null | string {
    if (text === null) {
        return null;
    }
    const line = messagePreviewLine(text);
    return line === '' ? null : line;
}

export function spanBetween(startedAt: null | string, terminalAt: null | string): null | string {
    const started = startedAt === null ? Number.NaN : Date.parse(startedAt);
    const ended = terminalAt === null ? Number.NaN : Date.parse(terminalAt);
    if (!(Number.isFinite(started) && Number.isFinite(ended))) {
        return null;
    }
    return formatCloudAgentDuration(Math.max(0, ended - started));
}
