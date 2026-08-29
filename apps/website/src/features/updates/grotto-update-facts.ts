import type {
    ComputerUpdateStep,
    DesktopUpdateStep,
    GrottoComponentFact,
    GrottoUpdateInput,
} from './grotto-update-contract.ts';

const activePhases = new Set([
    'checking',
    'downloading',
    'installing',
    'requested',
    'restarting',
    'verifying',
    'waiting-for-agents',
]);

export function projectComponentFacts(
    input: GrottoUpdateInput,
    computers: readonly ComputerUpdateStep[],
    desktop: DesktopUpdateStep | null
): GrottoComponentFact[] {
    const desktopTarget = input.release.components.desktopApp;
    const agentTarget = input.release.components.agent;
    const facts: GrottoComponentFact[] = [];
    if (input.desktop.kind === 'desktop') {
        facts.push({
            currentVersion: desktop?.currentVersion ?? input.desktop.currentVersion,
            detail: desktop?.phase === 'failed' ? desktop.detail : null,
            id: 'desktop-app',
            kind: 'desktop-app',
            label: 'Grotto App',
            remedy:
                desktop?.phase === 'failed'
                    ? 'Try again. If the problem continues, restart Grotto App.'
                    : null,
            status: desktop && desktopTarget ? statusForStep(desktop) : 'external',
            targetVersion: desktopTarget,
        });
    }
    facts.push(...computers.map(computerFact));
    if (computers.length > 0 && input.runningAgentVersion !== null) {
        facts.push({
            currentVersion: input.runningAgentVersion,
            detail: null,
            id: 'agent',
            kind: 'agent',
            label: 'Agent',
            remedy: null,
            status: agentTarget
                ? input.runningAgentVersion === agentTarget
                    ? 'current'
                    : 'pending'
                : 'external',
            targetVersion: agentTarget,
        });
    }
    return facts;
}

function computerFact(step: ComputerUpdateStep): GrottoComponentFact {
    return {
        currentVersion: step.currentVersion,
        detail: step.phase === 'failed' ? step.detail : null,
        id: step.id,
        kind: 'computer',
        label: step.label,
        remedy: step.phase === 'failed' ? computerFailureRemedy(step.failedPhase) : null,
        status: statusForStep(step),
        targetVersion: step.targetVersion,
    };
}

function statusForStep(
    step: ComputerUpdateStep | DesktopUpdateStep
): GrottoComponentFact['status'] {
    if (step.phase === 'current') {
        return 'current';
    }
    if (step.phase === 'failed') {
        return 'failed';
    }
    return activePhases.has(step.phase) || step.phase === 'restart-required'
        ? 'updating'
        : 'pending';
}

function computerFailureRemedy(failedPhase: string | null) {
    if (failedPhase === 'waiting-for-agents') {
        return 'Finish or stop active Agent work, then try again.';
    }
    if (failedPhase === 'restarting' || failedPhase === 'installing') {
        return 'Open this Computer in Settings for recovery steps.';
    }
    return 'Check this Computer’s connection, then try again.';
}
