import type { ComputerUpdateProgress } from './update-contract.ts';

/**
 * Dependency-free progress rendering for the synchronous `grotto-computer
 * upgrade` command. A TTY gets one live line per phase (rewritten in place,
 * finalized on phase change); anything else gets sparse plain lines with no
 * ANSI codes and no carriage returns.
 */

export interface UpgradeOutput {
    isTTY: boolean;
    write(text: string): void;
}

export interface UpgradeRenderer {
    finish(): void;
    observe(progress: ComputerUpdateProgress): void;
}

const BAR_WIDTH = 24;
const CLEAR_LINE = '\r[2K';

export function createUpgradeRenderer(output: UpgradeOutput): UpgradeRenderer {
    let livePhase: ComputerUpdateProgress['phase'] | null = null;
    let liveLine = '';

    const finalizeLive = () => {
        if (livePhase !== null && output.isTTY) {
            output.write('\n');
        }
        livePhase = null;
        liveLine = '';
    };

    return {
        finish() {
            finalizeLive();
        },
        observe(progress) {
            if (progress.phase === 'failed') {
                finalizeLive();
                output.write(`${failureLine(progress)}\n`);
                return;
            }
            const line = output.isTTY ? ttyLine(progress) : plainLine(progress);
            if (line === null || (livePhase === progress.phase && line === liveLine)) {
                return;
            }
            if (output.isTTY) {
                if (livePhase !== null && livePhase !== progress.phase) {
                    output.write('\n');
                }
                output.write(`${CLEAR_LINE}${line}`);
            } else {
                output.write(`${line}\n`);
            }
            livePhase = progress.phase;
            liveLine = line;
        },
    };
}

/** One-sentence outcome when another process already holds the update job. */
export function describeConcurrentUpdate(progress: ComputerUpdateProgress): string {
    const target = progress.targetVersion ? ` to ${progress.targetVersion}` : '';
    return `Another Grotto Computer update${target} is already in progress (${concurrentState(progress)}). Re-run grotto-computer upgrade to check on it.`;
}

function ttyLine(progress: ComputerUpdateProgress): string | null {
    if (progress.phase === 'downloading') {
        const downloaded = progress.downloadedBytes ?? 0;
        if (progress.totalBytes === null) {
            return `Downloading ${target(progress)}  ${formatBytes(downloaded)}`;
        }
        const fraction = Math.min(downloaded / progress.totalBytes, 1);
        const filled = Math.floor(fraction * BAR_WIDTH);
        const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
        return `Downloading ${target(progress)}  [${bar}] ${Math.floor(fraction * 100)}%  ${formatBytes(downloaded)} / ${formatBytes(progress.totalBytes)}`;
    }
    return plainLine(progress);
}

function plainLine(progress: ComputerUpdateProgress): string | null {
    switch (progress.phase) {
        case 'requested':
            return `Update requested: ${target(progress)}.`;
        case 'downloading':
            return progress.totalBytes === null
                ? `Downloading ${target(progress)}…`
                : `Downloading ${target(progress)} (${formatBytes(progress.totalBytes)})…`;
        case 'verifying':
            return 'Verifying signature and integrity…';
        case 'waiting-for-agents': {
            const count = progress.activeAgentCount;
            if (!count) {
                return 'Waiting for active Agents to finish…';
            }
            return `Waiting for ${count} active Agent${count === 1 ? '' : 's'} to finish…`;
        }
        case 'installing':
            return `Installing ${target(progress)}…`;
        case 'restarting':
            return 'Restarting Grotto Computer…';
        default:
            return progress.detail;
    }
}

function failureLine(progress: ComputerUpdateProgress): string {
    const failedPhase = progress.failedPhase;
    const step = failedPhase === null ? null : failedStepLabels[failedPhase];
    return step ? `Update failed while ${step}.` : 'Update failed.';
}

const failedStepLabels: Record<Exclude<ComputerUpdateProgress['phase'], 'failed'>, string> = {
    available: 'preparing the update',
    checking: 'checking for the latest release',
    complete: 'finishing the update',
    downloading: 'downloading the release',
    idle: 'preparing the update',
    installing: 'installing the update',
    requested: 'requesting the update',
    restarting: 'restarting Grotto Computer',
    verifying: 'verifying the release',
    'waiting-for-agents': 'waiting for active Agents',
};

function concurrentState(progress: ComputerUpdateProgress): string {
    if (progress.phase === 'downloading' && progress.downloadedBytes !== null) {
        const total = progress.totalBytes === null ? '' : ` of ${formatBytes(progress.totalBytes)}`;
        return `downloading, ${formatBytes(progress.downloadedBytes)}${total}`;
    }
    if (progress.phase === 'waiting-for-agents' && progress.activeAgentCount) {
        return `waiting for ${progress.activeAgentCount} active Agent${progress.activeAgentCount === 1 ? '' : 's'}`;
    }
    return progress.phase;
}

function target(progress: ComputerUpdateProgress): string {
    return progress.targetVersion ? `Grotto Computer ${progress.targetVersion}` : 'Grotto Computer';
}

function formatBytes(bytes: number): string {
    if (bytes >= 1_000_000) {
        return `${(bytes / 1_000_000).toFixed(1)} MB`;
    }
    if (bytes >= 1000) {
        return `${Math.round(bytes / 1000)} kB`;
    }
    return `${bytes} B`;
}
