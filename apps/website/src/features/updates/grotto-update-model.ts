import type {
    ComputerUpdateStep,
    DesktopUpdateStep,
    GrottoUpdateComputer,
    GrottoUpdateComputerPhase,
    GrottoUpdateDesktop,
    GrottoUpdateInput,
    GrottoUpdatePhase,
    GrottoUpdateStep,
    GrottoUpdateView,
} from './grotto-update-contract.ts';
import { projectComponentFacts } from './grotto-update-facts.ts';
import { expectedComputerRestartMs } from './grotto-update-timing.ts';

export type {
    ComputerUpdateStep,
    DesktopUpdateStep,
    GrottoComponentFact,
    GrottoReleaseSnapshot,
    GrottoUpdateComputer,
    GrottoUpdateComputerPhase,
    GrottoUpdateDesktop,
    GrottoUpdateInput,
    GrottoUpdatePhase,
    GrottoUpdateStep,
    GrottoUpdateView,
} from './grotto-update-contract.ts';

const activeComputerPhases = new Set<GrottoUpdateComputerPhase>([
    'checking',
    'downloading',
    'installing',
    'requested',
    'restarting',
    'verifying',
    'waiting-for-agents',
]);

export function projectGrottoUpdate(input: GrottoUpdateInput): GrottoUpdateView {
    const observedAt = input.observedAt ?? Date.now();
    const computerTarget = input.release.components.computer;
    const projectedComputerSteps = computerTarget
        ? input.computers
              .map((computer) => projectComputerStep(computer, computerTarget, observedAt))
              .filter((step): step is ComputerUpdateStep => step !== null)
        : [];
    const computerSteps = projectedComputerSteps
        .map((step) => ({
            ...step,
            label: projectedComputerSteps.length === 1 ? 'Computer' : `Computer · ${step.label}`,
        }))
        .sort(compareComputerSteps);
    const desktopStep = projectDesktopStep(input.desktop, input.release.components.desktopApp);
    const steps = desktopStep ? [...computerSteps, desktopStep] : computerSteps;
    const phase = aggregatePhase(steps);

    return {
        componentFacts: projectComponentFacts(input, computerSteps, desktopStep),
        detail: aggregateDetail(phase, steps),
        headline: aggregateHeadline(phase, input.release.version),
        phase,
        primaryAction: primaryAction(phase),
        steps,
        version: input.release.version,
    };
}

export function isCompleteUpdateStep(step: GrottoUpdateStep) {
    return step.phase === 'current';
}

export function isActiveUpdateStep(step: GrottoUpdateStep) {
    return step.kind === 'computer'
        ? step.phase !== 'current' && activeComputerPhases.has(step.phase)
        : ['checking', 'downloading', 'restarting'].includes(step.phase);
}

function projectComputerStep(
    computer: GrottoUpdateComputer,
    targetVersion: string,
    observedAt: number
): ComputerUpdateStep | null {
    const timedOutRestart =
        computer.health === 'offline' &&
        computer.phase === 'restarting' &&
        elapsedSince(computer.updateUpdatedAt, observedAt) >= expectedComputerRestartMs;
    if (computer.health === 'offline' && computer.phase !== 'restarting') {
        return null;
    }
    const current = isVersionCurrent(computer.currentVersion, targetVersion);
    const phase = timedOutRestart
        ? 'failed'
        : current
          ? 'current'
          : normalizeComputerPhase(computer, targetVersion);
    return {
        currentVersion: computer.currentVersion,
        detail: timedOutRestart
            ? 'This Computer did not reconnect after installing the update.'
            : (computer.detail ?? null),
        failedPhase: timedOutRestart ? 'restarting' : (computer.failedPhase ?? null),
        id: computer.id,
        kind: 'computer',
        label: computer.name,
        phase,
        progress: computer.progress ?? null,
        targetVersion,
    };
}

function normalizeComputerPhase(
    computer: GrottoUpdateComputer,
    targetVersion: string
): ComputerUpdateStep['phase'] {
    if (activeComputerPhases.has(computer.phase)) {
        return computer.phase;
    }
    if (computer.phase === 'failed' && computer.reportedTargetVersion === targetVersion) {
        return 'failed';
    }
    return 'available';
}

function projectDesktopStep(
    desktop: GrottoUpdateDesktop,
    targetVersion: string | null
): DesktopUpdateStep | null {
    if (desktop.kind === 'web') {
        return null;
    }
    if (!targetVersion) {
        return null;
    }
    const phase = isVersionCurrent(desktop.currentVersion, targetVersion)
        ? 'current'
        : desktop.phase === 'error'
          ? 'failed'
          : desktop.phase === 'ready'
            ? 'restart-required'
            : desktop.phase === 'idle' || desktop.phase === 'current'
              ? 'pending'
              : desktop.phase;
    return {
        currentVersion: desktop.currentVersion,
        detail: desktop.detail ?? null,
        id: 'desktop-app',
        kind: 'desktop-app',
        label: 'Grotto App',
        phase,
        progress: desktop.progress ?? null,
        targetVersion,
    };
}

function aggregatePhase(steps: readonly GrottoUpdateStep[]): GrottoUpdatePhase {
    if (steps.some(isActiveUpdateStep)) {
        return 'updating';
    }
    if (steps.some((step) => step.phase === 'restart-required')) {
        return 'restart-required';
    }
    if (steps.some((step) => step.phase === 'failed')) {
        return 'failed';
    }
    if (steps.some((step) => !isCompleteUpdateStep(step))) {
        return 'available';
    }
    return 'current';
}

function aggregateHeadline(phase: GrottoUpdatePhase, version: string) {
    switch (phase) {
        case 'current':
            return `Grotto ${version}`;
        case 'available':
            return `Grotto ${version} is ready`;
        case 'updating':
            return `Updating Grotto ${version}`;
        case 'restart-required':
            return 'Restart to finish';
        case 'failed':
            return 'Update needs attention';
    }
}

function aggregateDetail(phase: GrottoUpdatePhase, steps: readonly GrottoUpdateStep[]) {
    const remaining = steps.filter((step) => !isCompleteUpdateStep(step));
    const active = steps.find(isActiveUpdateStep);
    switch (phase) {
        case 'current':
            return 'Everything in this release is current.';
        case 'available':
            return `${remaining.length} ${remaining.length === 1 ? 'update is' : 'updates are'} ready.`;
        case 'updating':
            return active ? `Updating ${active.label}.` : 'Update in progress.';
        case 'restart-required':
            return 'The Grotto App is ready to restart.';
        case 'failed': {
            const failed = steps.find((step) => step.phase === 'failed');
            return (
                failed?.detail ?? (failed ? `${failed.label} could not update.` : 'Update failed.')
            );
        }
    }
}

function primaryAction(phase: GrottoUpdatePhase): GrottoUpdateView['primaryAction'] {
    if (phase === 'available') {
        return { kind: 'start', label: 'Update' };
    }
    if (phase === 'restart-required') {
        return { kind: 'restart', label: 'Restart' };
    }
    if (phase === 'failed') {
        return { kind: 'retry', label: 'Try again' };
    }
    return null;
}

function isVersionCurrent(installed: string | null, target: string) {
    if (!installed) {
        return false;
    }
    const installedParts = parseSemver(installed);
    const targetParts = parseSemver(target);
    for (let index = 0; index < 3; index += 1) {
        const difference = (installedParts[index] ?? 0) - (targetParts[index] ?? 0);
        if (difference !== 0) {
            return difference > 0;
        }
    }
    return true;
}

function parseSemver(version: string) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
    return match ? match.slice(1).map(Number) : [-1, -1, -1];
}

function elapsedSince(value: string | null | undefined, observedAt: number) {
    if (!value) {
        return Number.POSITIVE_INFINITY;
    }
    return observedAt - new Date(value).getTime();
}

function compareComputerSteps(left: ComputerUpdateStep, right: ComputerUpdateStep) {
    return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}
