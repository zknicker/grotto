import { RelativeTime } from '../../components/time/relative-time.tsx';
import type { GrottoUpdateView } from './grotto-update-model.ts';
import { isActiveUpdateStep } from './grotto-update-model.ts';
import { GrottoUpdateProgress } from './grotto-update-progress.tsx';
import { GrottoVersionBreakdown } from './grotto-version-breakdown.tsx';
import type { OfflineComputerNotice } from './use-offline-computers.ts';

export function UpdateTooltipContent({ view }: { view: GrottoUpdateView }) {
    const activeStepIds = new Set(view.steps.filter(isActiveUpdateStep).map((step) => step.id));
    const visibleFacts = view.componentFacts.filter(
        (fact) =>
            fact.status !== 'current' && fact.status !== 'external' && !activeStepIds.has(fact.id)
    );
    const hasSurfaceFailure = visibleFacts.some((fact) => fact.status === 'failed');
    return (
        <div className="grid gap-2.5">
            <p className="text-foreground text-sm">{tooltipTitle(view)}</p>
            <GrottoUpdateProgress steps={view.steps} />
            {visibleFacts.length > 0 ? <GrottoVersionBreakdown facts={visibleFacts} /> : null}
            {view.phase === 'failed' && !hasSurfaceFailure ? (
                <p className="grid gap-0.5 text-danger text-sm">
                    <span>{view.detail}</span>
                    <span className="text-foreground">
                        Try again. If it continues, restart Grotto.
                    </span>
                </p>
            ) : null}
        </div>
    );
}

export function OfflineComputersTooltipContent({
    computers,
}: {
    computers: readonly OfflineComputerNotice[];
}) {
    return (
        <div className="grid gap-2.5 text-sm">
            <p className="text-foreground">
                {computers.length === 1 ? 'Computer offline' : 'Computers offline'}
            </p>
            <dl className="grid gap-2.5">
                {computers.map((computer) => (
                    <div className="grid gap-0.5" key={computer.id}>
                        <dt className="text-foreground">{computer.name}</dt>
                        <dd className="text-muted">
                            Last connected:{' '}
                            <RelativeTime fallback="Never" value={computer.lastConnectedAt} />
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

function tooltipTitle(view: GrottoUpdateView) {
    switch (view.phase) {
        case 'available':
            return 'Click to update';
        case 'restart-required':
            return 'Click to restart';
        case 'failed':
            return 'Click to try again';
        case 'updating':
            return 'Updating';
        case 'current':
            return 'Up to date';
    }
}
