import { Button, ProgressCircle, Tooltip } from '@heroui/react';
import {
    Alert01Icon,
    ComputerIcon,
    Download04Icon,
    ReloadIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    OfflineComputersTooltipContent,
    UpdateTooltipContent,
} from './grotto-status-tooltip-content.tsx';
import type { GrottoUpdateView } from './grotto-update-model.ts';
import type { OfflineComputerNotice } from './use-offline-computers.ts';

export function GrottoUpdateFooter({
    isRunning = false,
    offlineComputers = [],
    onAction,
    onOpenComputer,
    view,
}: {
    isRunning?: boolean;
    offlineComputers?: readonly OfflineComputerNotice[];
    onAction?: (action: NonNullable<GrottoUpdateView['primaryAction']>) => void;
    onOpenComputer?: (computerId: string) => void;
    view: GrottoUpdateView;
}) {
    if (view.phase === 'current' && offlineComputers.length === 0) {
        return null;
    }

    return (
        <section
            aria-label="Grotto status"
            aria-live="polite"
            className="flex w-full items-center gap-2 px-2"
        >
            {view.phase === 'current' ? null : (
                <UpdateTooltipButton isRunning={isRunning} onAction={onAction} view={view} />
            )}
            {offlineComputers.length > 0 ? (
                <OfflineComputersButton
                    computers={offlineComputers}
                    onOpenComputer={onOpenComputer}
                />
            ) : null}
        </section>
    );
}

function UpdateTooltipButton({
    isRunning,
    onAction,
    view,
}: {
    isRunning: boolean;
    onAction?: (action: NonNullable<GrottoUpdateView['primaryAction']>) => void;
    view: GrottoUpdateView;
}) {
    const inactive = isRunning || view.phase === 'updating';
    return (
        <Tooltip closeDelay={0} delay={0}>
            <Tooltip.Trigger role="presentation" tabIndex={-1}>
                <Button
                    aria-disabled={inactive}
                    aria-label={buttonLabel(view)}
                    isIconOnly
                    onPress={() => {
                        if (!inactive && view.primaryAction) {
                            onAction?.(view.primaryAction);
                        }
                    }}
                    size="sm"
                    variant={view.phase === 'failed' ? 'danger-soft' : 'primary'}
                >
                    <FooterMark view={view} />
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content
                className="grotto-status-tooltip--contrast w-fit min-w-80 p-3"
                offset={10}
                placement="top start"
            >
                <UpdateTooltipContent view={view} />
            </Tooltip.Content>
        </Tooltip>
    );
}

function OfflineComputersButton({
    computers,
    onOpenComputer,
}: {
    computers: readonly OfflineComputerNotice[];
    onOpenComputer?: (computerId: string) => void;
}) {
    const noun = computers.length === 1 ? 'Computer is' : 'Computers are';
    return (
        <Tooltip closeDelay={0} delay={0}>
            <Tooltip.Trigger role="presentation" tabIndex={-1}>
                <Button
                    aria-label={`${computers.length} ${noun} offline`}
                    className="grotto-offline-button"
                    isIconOnly
                    onPress={() => {
                        const first = computers[0];
                        if (first) {
                            onOpenComputer?.(first.id);
                        }
                    }}
                    size="sm"
                    variant="secondary"
                >
                    <Icon aria-hidden="true" icon={ComputerIcon} />
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content
                className="grotto-status-tooltip--contrast w-fit min-w-72 p-3"
                offset={10}
                placement="top start"
            >
                <OfflineComputersTooltipContent computers={computers} />
            </Tooltip.Content>
        </Tooltip>
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
        case 'failed':
            return `Grotto update failed. ${view.detail}`;
    }
}
