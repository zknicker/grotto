import {
    type ComputerUpdateStep,
    type DesktopUpdateStep,
    type GrottoUpdateStep,
    type GrottoUpdateView,
    isCompleteUpdateStep,
} from './grotto-update-model.ts';

export interface GrottoUpdateFailure {
    detail: string;
    stepId: string;
}

export type GrottoUpdateRunResult =
    | { kind: 'complete' }
    | { failures: readonly GrottoUpdateFailure[]; kind: 'failed' }
    | { kind: 'restart-required'; targetVersion: string }
    | { kind: 'restarting'; targetVersion: string };

export interface GrottoUpdateOperations {
    downloadDesktop: (targetVersion: string) => Promise<void>;
    readView: () => GrottoUpdateView | Promise<GrottoUpdateView>;
    restartDesktop: (targetVersion: string) => Promise<void>;
    updateComputer: (input: { computerId: string; targetVersion: string }) => Promise<void>;
    waitForChange: (step: GrottoUpdateStep) => Promise<void>;
}

export function createGrottoUpdateController(operations: GrottoUpdateOperations) {
    let activeRun: Promise<GrottoUpdateRunResult> | null = null;

    return {
        run() {
            if (activeRun) {
                return activeRun;
            }
            activeRun = runGrottoUpdateSequence(operations).finally(() => {
                activeRun = null;
            });
            return activeRun;
        },
    };
}

export async function runGrottoUpdateSequence(
    operations: GrottoUpdateOperations
): Promise<GrottoUpdateRunResult> {
    const initialView = await operations.readView();
    const initialRestart = desktopRestartStep(initialView.steps);
    if (initialRestart) {
        try {
            await operations.restartDesktop(initialRestart.targetVersion);
            return { kind: 'restarting', targetVersion: initialRestart.targetVersion };
        } catch (error) {
            return {
                failures: [failureForStep(initialRestart, error)],
                kind: 'failed',
            };
        }
    }

    const selectedSteps = initialView.steps.filter((step) => !isCompleteUpdateStep(step));
    const outcomes = await Promise.all(
        selectedSteps.map((step) => reconcileStep(step, operations))
    );
    const finalView = await operations.readView();
    const finalRestart = desktopRestartStep(finalView.steps);
    if (finalRestart) {
        return { kind: 'restart-required', targetVersion: finalRestart.targetVersion };
    }

    const selectedIds = new Set(selectedSteps.map((step) => step.id));
    const finalFailures = finalView.steps
        .filter((step) => selectedIds.has(step.id) && step.phase === 'failed')
        .map((step) => ({
            detail: step.detail ?? `${step.label} could not update.`,
            stepId: step.id,
        }));
    const failures = deduplicateFailures([
        ...outcomes.filter((failure): failure is GrottoUpdateFailure => failure !== null),
        ...finalFailures,
    ]).filter((failure) => {
        const step = finalView.steps.find((candidate) => candidate.id === failure.stepId);
        return !(step && isCompleteUpdateStep(step));
    });
    return failures.length > 0 ? { failures, kind: 'failed' } : { kind: 'complete' };
}

async function reconcileStep(
    initialStep: GrottoUpdateStep,
    operations: GrottoUpdateOperations
): Promise<GrottoUpdateFailure | null> {
    try {
        if (shouldStartComputer(initialStep)) {
            await operations.updateComputer({
                computerId: initialStep.id,
                targetVersion: initialStep.targetVersion,
            });
        } else if (shouldDownloadDesktop(initialStep)) {
            await operations.downloadDesktop(initialStep.targetVersion);
        }
        await observeUntilSettled(initialStep, operations);
        return null;
    } catch (error) {
        return failureForStep(initialStep, error);
    }
}

async function observeUntilSettled(
    initialStep: GrottoUpdateStep,
    operations: GrottoUpdateOperations
) {
    let step = findStep(await operations.readView(), initialStep.id) ?? initialStep;
    while (!isSettled(step)) {
        await operations.waitForChange(step);
        const next = findStep(await operations.readView(), step.id);
        if (!next) {
            return;
        }
        step = next;
    }
}

function shouldStartComputer(step: GrottoUpdateStep): step is ComputerUpdateStep {
    return (
        step.kind === 'computer' &&
        (step.phase === 'available' || step.phase === 'failed' || step.phase === 'idle')
    );
}

function shouldDownloadDesktop(step: GrottoUpdateStep): step is DesktopUpdateStep {
    return (
        step.kind === 'desktop-app' &&
        (step.phase === 'available' || step.phase === 'failed' || step.phase === 'pending')
    );
}

function isSettled(step: GrottoUpdateStep) {
    return (
        isCompleteUpdateStep(step) || step.phase === 'failed' || step.phase === 'restart-required'
    );
}

function desktopRestartStep(steps: readonly GrottoUpdateStep[]) {
    return steps.find(
        (step): step is DesktopUpdateStep =>
            step.kind === 'desktop-app' && step.phase === 'restart-required'
    );
}

function findStep(view: GrottoUpdateView, stepId: string) {
    return view.steps.find((step) => step.id === stepId);
}

function deduplicateFailures(failures: readonly GrottoUpdateFailure[]) {
    return [...new Map(failures.map((failure) => [failure.stepId, failure])).values()];
}

function failureForStep(step: GrottoUpdateStep, error: unknown): GrottoUpdateFailure {
    return {
        detail: error instanceof Error ? error.message : `${step.label} could not update.`,
        stepId: step.id,
    };
}
