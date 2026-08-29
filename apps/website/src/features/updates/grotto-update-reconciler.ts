import {
    type ComputerUpdateStep,
    type DesktopUpdateStep,
    type GrottoUpdateStep,
    type GrottoUpdateView,
    isCompleteUpdateStep,
} from './grotto-update-model.ts';

export type GrottoUpdateAction =
    | { computerId: string; kind: 'update-computer'; retry: boolean; targetVersion: string }
    | { kind: 'download-desktop'; retry: boolean; targetVersion: string }
    | { kind: 'restart-desktop'; targetVersion: string }
    | { kind: 'wait'; step: GrottoUpdateStep }
    | { kind: 'blocked'; step: ComputerUpdateStep }
    | { kind: 'complete' };

export type GrottoUpdateRunResult =
    | { kind: 'blocked'; computerId: string }
    | { kind: 'complete' }
    | { kind: 'failed'; stepId: string }
    | { kind: 'restart-required'; targetVersion: string }
    | { kind: 'restarting'; targetVersion: string };

export interface GrottoUpdateOperations {
    downloadDesktop: (targetVersion: string) => Promise<void>;
    readView: () => GrottoUpdateView | Promise<GrottoUpdateView>;
    restartDesktop: (targetVersion: string) => Promise<void>;
    updateComputer: (input: { computerId: string; targetVersion: string }) => Promise<void>;
    waitForChange: (step: GrottoUpdateStep) => Promise<void>;
}

export function nextGrottoUpdateAction(view: GrottoUpdateView): GrottoUpdateAction {
    for (const step of view.steps) {
        if (isCompleteUpdateStep(step)) {
            continue;
        }

        return step.kind === 'computer' ? nextComputerAction(step) : nextDesktopAction(step);
    }

    return { kind: 'complete' };
}

export function createGrottoUpdateController(operations: GrottoUpdateOperations) {
    let activeRun: Promise<GrottoUpdateRunResult> | null = null;

    return {
        run() {
            if (activeRun) {
                return activeRun;
            }

            activeRun = (async () => {
                try {
                    return await runGrottoUpdateSequence(operations);
                } finally {
                    activeRun = null;
                }
            })();
            return activeRun;
        },
    };
}

export async function runGrottoUpdateSequence(
    operations: GrottoUpdateOperations,
    maximumTransitions = 100
): Promise<GrottoUpdateRunResult> {
    const initialView = await operations.readView();
    const retryableStepIds = new Set(
        initialView.steps.filter((step) => step.phase === 'failed').map((step) => step.id)
    );
    const attemptedStepIds = new Set<string>();
    const canRestartDesktop = nextGrottoUpdateAction(initialView).kind === 'restart-desktop';
    let view = initialView;

    for (let transition = 0; transition < maximumTransitions; transition += 1) {
        const action = nextGrottoUpdateAction(view);

        switch (action.kind) {
            case 'update-computer': {
                if (
                    (action.retry && !retryableStepIds.has(action.computerId)) ||
                    attemptedStepIds.has(action.computerId)
                ) {
                    return { kind: 'failed', stepId: action.computerId };
                }
                attemptedStepIds.add(action.computerId);
                await operations.updateComputer({
                    computerId: action.computerId,
                    targetVersion: action.targetVersion,
                });
                view = await operations.readView();
                const computer = findStep(view, action.computerId);
                if (shouldWaitAfterOperation(computer)) {
                    await operations.waitForChange(computer);
                    view = await operations.readView();
                }
                break;
            }
            case 'download-desktop': {
                const stepId = 'desktop-app';
                if (
                    (action.retry && !retryableStepIds.has(stepId)) ||
                    attemptedStepIds.has(stepId)
                ) {
                    return { kind: 'failed', stepId };
                }
                attemptedStepIds.add(stepId);
                await operations.downloadDesktop(action.targetVersion);
                view = await operations.readView();
                const desktop = findStep(view, stepId);
                if (shouldWaitAfterOperation(desktop)) {
                    await operations.waitForChange(desktop);
                    view = await operations.readView();
                }
                break;
            }
            case 'restart-desktop':
                if (!canRestartDesktop) {
                    return { kind: 'restart-required', targetVersion: action.targetVersion };
                }
                await operations.restartDesktop(action.targetVersion);
                return { kind: 'restarting', targetVersion: action.targetVersion };
            case 'wait':
                await operations.waitForChange(action.step);
                view = await operations.readView();
                break;
            case 'blocked':
                return { computerId: action.step.id, kind: 'blocked' };
            case 'complete':
                return { kind: 'complete' };
        }
    }

    throw new Error(`Grotto update did not settle after ${maximumTransitions} state changes.`);
}

function nextComputerAction(step: ComputerUpdateStep): GrottoUpdateAction {
    switch (step.phase) {
        case 'available':
        case 'failed':
        case 'idle':
            return {
                computerId: step.id,
                kind: 'update-computer',
                retry: step.phase === 'failed',
                targetVersion: step.targetVersion,
            };
        case 'offline':
            return { kind: 'blocked', step };
        case 'checking':
        case 'complete':
        case 'downloading':
        case 'installing':
        case 'requested':
        case 'restarting':
        case 'verifying':
        case 'waiting-for-agents':
            return { kind: 'wait', step };
        case 'current':
            return { kind: 'complete' };
    }
}

function nextDesktopAction(step: DesktopUpdateStep): GrottoUpdateAction {
    switch (step.phase) {
        case 'available':
        case 'failed':
        case 'pending':
            return {
                kind: 'download-desktop',
                retry: step.phase === 'failed',
                targetVersion: step.targetVersion,
            };
        case 'restart-required':
            return { kind: 'restart-desktop', targetVersion: step.targetVersion };
        case 'checking':
        case 'downloading':
        case 'restarting':
            return { kind: 'wait', step };
        case 'current':
            return { kind: 'complete' };
    }
}

function findStep(view: GrottoUpdateView, stepId: string) {
    const step = view.steps.find((candidate) => candidate.id === stepId);
    if (!step) {
        throw new Error(`Grotto update step ${stepId} disappeared while updating.`);
    }
    return step;
}

function shouldWaitAfterOperation(step: GrottoUpdateStep) {
    return !['current', 'failed', 'restart-required'].includes(step.phase);
}
