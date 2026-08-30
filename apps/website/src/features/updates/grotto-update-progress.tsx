import { Label, ProgressBar } from '@heroui/react';
import { computerUpdatePhaseLabel } from '../computers/computer-update-model.ts';
import type { GrottoUpdateStep } from './grotto-update-model.ts';
import { isActiveUpdateStep } from './grotto-update-model.ts';

export function GrottoUpdateProgress({ steps }: { steps: readonly GrottoUpdateStep[] }) {
    const activeSteps = steps.filter(isActiveUpdateStep);

    if (activeSteps.length === 0) {
        return null;
    }

    return (
        <div className="grid min-w-72 gap-3">
            {activeSteps.map((step) => (
                <div className="grid gap-1.5" key={step.id}>
                    <div className="flex items-baseline justify-between gap-8 text-sm">
                        <p className="min-w-0 truncate text-foreground">{step.label}</p>
                        <p className="whitespace-nowrap font-mono text-muted tabular-nums">
                            {step.currentVersion ?? 'Unknown'} → {step.targetVersion}
                        </p>
                    </div>
                    <UpdateProgressBar label={updateStepLabel(step)} progress={step.progress} />
                </div>
            ))}
        </div>
    );
}

export function UpdateProgressBar({ label, progress }: { label: string; progress: number | null }) {
    const value = progress === null ? 0 : Math.min(1, Math.max(0, progress)) * 100;

    return (
        <ProgressBar
            aria-label={label}
            className="w-64 max-w-full"
            isIndeterminate={progress === null}
            size="sm"
            value={value}
        >
            <Label>{label}</Label>
            {progress === null ? null : <ProgressBar.Output />}
            <ProgressBar.Track>
                <ProgressBar.Fill />
            </ProgressBar.Track>
        </ProgressBar>
    );
}

function updateStepLabel(step: GrottoUpdateStep) {
    if (step.kind === 'computer') {
        if (step.phase === 'current') {
            return 'Up to date';
        }
        return computerUpdatePhaseLabel(step.phase);
    }

    switch (step.phase) {
        case 'checking':
            return 'Checking for a Grotto App update…';
        case 'downloading':
            return 'Downloading Grotto App';
        case 'restarting':
            return 'Restarting Grotto App';
        default:
            return 'Updating Grotto App';
    }
}
