import { Button, ProgressCircle } from '@heroui/react';
import { Alert01Icon, Download04Icon, ReloadIcon } from '@hugeicons-pro/core-stroke-rounded';
import { CursorHoverCard } from '../../components/ui/cursor-hover-card.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { GrottoUpdateView } from './grotto-update-model.ts';
import { GrottoVersionBreakdown } from './grotto-version-breakdown.tsx';

export function GrottoUpdateFooter({
    onAction,
    view,
}: {
    onAction?: (action: NonNullable<GrottoUpdateView['primaryAction']>) => void;
    view: GrottoUpdateView;
}) {
    if (view.phase === 'current') {
        return null;
    }

    return (
        <section aria-label="Grotto update" aria-live="polite" className="flex w-full px-2">
            <CursorHoverCard
                className="w-fit min-w-80 p-3"
                content={<GrottoVersionBreakdown facts={view.componentFacts} />}
                tone="contrast"
            >
                <Button
                    aria-label={buttonLabel(view)}
                    isIconOnly
                    onPress={() => {
                        if (view.primaryAction) {
                            onAction?.(view.primaryAction);
                        }
                    }}
                    size="sm"
                    variant={isAttentionPhase(view) ? 'danger-soft' : 'primary'}
                >
                    <FooterMark view={view} />
                </Button>
            </CursorHoverCard>
        </section>
    );
}

function FooterMark({ view }: { view: GrottoUpdateView }) {
    switch (view.phase) {
        case 'updating':
            return (
                <ProgressCircle aria-label="Updating" isIndeterminate size="sm">
                    <ProgressCircle.Track>
                        <ProgressCircle.TrackCircle className="stroke-current opacity-30" />
                        <ProgressCircle.FillCircle className="stroke-current" />
                    </ProgressCircle.Track>
                </ProgressCircle>
            );
        case 'available':
            return <Icon aria-hidden="true" icon={Download04Icon} />;
        case 'restart-required':
            return <Icon aria-hidden="true" icon={ReloadIcon} />;
        case 'blocked':
        case 'failed':
            return <Icon aria-hidden="true" icon={Alert01Icon} />;
        case 'current':
            return null;
    }
}

function buttonLabel(view: GrottoUpdateView) {
    switch (view.phase) {
        case 'current':
            return 'Grotto is up to date';
        case 'available':
            return `Update Grotto to ${view.version}`;
        case 'updating':
            return `Updating Grotto. ${view.detail}`;
        case 'restart-required':
            return 'Restart Grotto to finish updating';
        case 'blocked':
            return `Grotto update blocked. ${view.detail}`;
        case 'failed':
            return `Grotto update failed. ${view.detail}`;
    }
}

function isAttentionPhase(view: GrottoUpdateView) {
    return view.phase === 'blocked' || view.phase === 'failed';
}
