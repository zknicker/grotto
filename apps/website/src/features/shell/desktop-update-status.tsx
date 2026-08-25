import { Button, ProgressCircle } from '@heroui/react';
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
                <Button onPress={onUpdate} size="sm" variant="secondary">
                    Update available
                </Button>
            );
        case 'downloading': {
            const percentage = Math.round(status.progress * 100);
            return (
                <Button aria-label={`Downloading update, ${percentage}%`} isDisabled size="sm">
                    <UpdateProgress value={percentage} />
                    Updating · {percentage}%
                </Button>
            );
        }
        case 'ready':
            return (
                <Button onPress={onUpdate} size="sm">
                    Restart to update
                </Button>
            );
        case 'restarting':
            return (
                <Button aria-label="Restarting to finish the update" isDisabled size="sm">
                    <UpdateProgress isIndeterminate />
                    Restarting…
                </Button>
            );
        case 'error':
            return (
                <Button onPress={onCheck} size="sm" variant="secondary">
                    Update failed · Retry
                </Button>
            );
        case 'checking':
        case 'current':
        case 'idle':
        case 'unsupported':
            return null;
    }
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
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle />
            </ProgressCircle.Track>
        </ProgressCircle>
    );
}
