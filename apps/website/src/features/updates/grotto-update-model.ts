import type {
    ComputerUpdateStep,
    DesktopUpdateStep,
    GrottoComponentFact,
    GrottoUpdateComputer,
    GrottoUpdateComputerPhase,
    GrottoUpdateDesktop,
    GrottoUpdateInput,
    GrottoUpdatePhase,
    GrottoUpdateStep,
    GrottoUpdateView,
} from './grotto-update-contract.ts';

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
    const computers = [...input.computers].sort(compareComputers);
    const computerTarget = input.release.components.computer;
    const computerSteps = computerTarget
        ? computers.map((computer) => projectComputerStep(computer, computerTarget))
        : [];
    const desktopStep = projectDesktopStep(input.desktop, input.release.components.desktopApp);
    const steps = desktopStep ? [...computerSteps, desktopStep] : computerSteps;
    const phase = aggregatePhase(steps);

    return {
        componentFacts: componentFacts(input, computerSteps, desktopStep),
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
    targetVersion: string
): ComputerUpdateStep {
    return {
        currentVersion: computer.currentVersion,
        detail: computer.detail ?? null,
        id: computer.id,
        kind: 'computer',
        label: 'Computer',
        phase: isVersionCurrent(computer.currentVersion, targetVersion)
            ? 'current'
            : computer.phase,
        progress: computer.progress ?? null,
        targetVersion,
    };
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
    if (steps.some((step) => step.phase === 'failed')) {
        return 'failed';
    }
    if (steps.some((step) => step.phase === 'offline')) {
        return 'blocked';
    }
    if (steps.some((step) => step.phase === 'restart-required')) {
        return 'restart-required';
    }
    if (steps.some(isActiveUpdateStep)) {
        return 'updating';
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
        case 'blocked':
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
        case 'blocked': {
            const blocked = steps.find((step) => step.phase === 'offline');
            return blocked
                ? `${blocked.label} must reconnect to continue.`
                : 'Reconnect to continue.';
        }
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
    if (phase === 'blocked' || phase === 'failed') {
        return { kind: 'retry', label: 'Try again' };
    }
    return null;
}

function componentFacts(
    input: GrottoUpdateInput,
    computers: readonly ComputerUpdateStep[],
    desktop: DesktopUpdateStep | null
): GrottoComponentFact[] {
    const computerTarget = input.release.components.computer;
    const desktopTarget = input.release.components.desktopApp;
    const serverTarget = input.release.components.server;
    const agentTarget = input.release.components.agent;
    const computerCurrent = computerTarget !== null && computers.every(isCompleteUpdateStep);
    return [
        {
            currentVersion: input.runningServerVersion,
            label: 'Server',
            status: serverTarget
                ? input.runningServerVersion === serverTarget
                    ? 'current'
                    : 'managed'
                : 'external',
            targetVersion: serverTarget,
        },
        {
            currentVersion: desktop?.currentVersion ?? null,
            label: 'Grotto App',
            status:
                desktop && desktopTarget
                    ? isCompleteUpdateStep(desktop)
                        ? 'current'
                        : 'pending'
                    : 'external',
            targetVersion: desktopTarget,
        },
        {
            currentVersion: commonComputerVersion(computers),
            label: 'Computer',
            status: computerTarget ? (computerCurrent ? 'current' : 'pending') : 'external',
            targetVersion: computerTarget,
        },
        {
            currentVersion: input.runningAgentVersion,
            label: 'Agent',
            status: agentTarget
                ? input.runningAgentVersion === agentTarget
                    ? 'current'
                    : 'managed'
                : 'external',
            targetVersion: agentTarget,
        },
        {
            currentVersion: null,
            label: 'iOS',
            status: 'external',
            targetVersion: input.release.components.ios
                ? `${input.release.components.ios.version} (${input.release.components.ios.buildNumber})`
                : null,
        },
    ];
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

function commonComputerVersion(computers: readonly ComputerUpdateStep[]) {
    const versions = new Set(computers.map((computer) => computer.currentVersion));
    return versions.size === 1 ? (computers[0]?.currentVersion ?? null) : null;
}

function compareComputers(left: GrottoUpdateComputer, right: GrottoUpdateComputer) {
    return left.id.localeCompare(right.id);
}
