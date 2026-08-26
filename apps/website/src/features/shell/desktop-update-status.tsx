import { Button, ProgressCircle, Tooltip } from '@heroui/react';
import { Alert01Icon, Download04Icon, ReloadIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import type { DesktopUpdateStatus } from '../../hooks/desktop/use-desktop-update.ts';

export function DesktopUpdateStatusControl({
    onCheck,
    onUpdate,
    status,
}: {
    onCheck: () => void;
    onUpdate: () => void;
    status: DesktopUpdateStatus;
}) {
    switch (status.phase) {
        case 'available':
            return (
                <Tooltip delay={0}>
                    <Button aria-label="Update available" isIconOnly onPress={onUpdate} size="sm">
                        <Icon icon={Download04Icon} />
                    </Button>
                    <Tooltip.Content placement="top">Update available</Tooltip.Content>
                </Tooltip>
            );
        case 'downloading': {
            const percentage = Math.round(status.progress * 100);
            return <UpdateProgressStatus label={`Updating · ${percentage}%`} value={percentage} />;
        }
        case 'ready':
            return (
                <Tooltip delay={0}>
                    <Button aria-label="Restart to update" isIconOnly onPress={onUpdate} size="sm">
                        <Icon icon={ReloadIcon} />
                    </Button>
                    <Tooltip.Content placement="top">Restart to update</Tooltip.Content>
                </Tooltip>
            );
        case 'restarting':
            return <UpdateProgressStatus isIndeterminate label="Restarting…" />;
        case 'error':
            return (
                <Tooltip delay={0}>
                    <Button
                        aria-label="Update failed. Retry"
                        isIconOnly
                        onPress={onCheck}
                        size="sm"
                        variant="danger-soft"
                    >
                        <Icon icon={Alert01Icon} />
                    </Button>
                    <Tooltip.Content placement="top">Update failed · Retry</Tooltip.Content>
                </Tooltip>
            );
        case 'checking':
        case 'current':
        case 'idle':
        case 'unsupported':
            return null;
    }
}

function UpdateProgressStatus({
    isIndeterminate = false,
    label,
    value = 0,
}: {
    isIndeterminate?: boolean;
    label: string;
    value?: number;
}) {
    return (
        <div
            className="button button--icon-only button--primary button--sm pointer-events-none"
            title={label}
        >
            <span className="sr-only">{label}</span>
            <span aria-hidden="true" className="contents">
                <UpdateProgress isIndeterminate={isIndeterminate} value={value} />
            </span>
        </div>
    );
}

function UpdateProgress({
    isIndeterminate = false,
    value = 0,
}: {
    isIndeterminate?: boolean;
    value?: number;
}) {
    return (
        <ProgressCircle
            aria-label={isIndeterminate ? 'Restarting' : 'Download progress'}
            isIndeterminate={isIndeterminate}
            size="sm"
            value={value}
        >
            <ProgressCircle.Track>
                <ProgressCircle.TrackCircle className="stroke-current opacity-30" />
                <ProgressCircle.FillCircle className="stroke-current" />
            </ProgressCircle.Track>
        </ProgressCircle>
    );
}
