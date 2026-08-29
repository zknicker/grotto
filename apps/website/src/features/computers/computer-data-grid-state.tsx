import { Button, EmptyState, Spinner } from '@heroui/react';
import type { IconSvgElement } from '@hugeicons/react';
import { AlertCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';

type ComputerDataGridStateProps =
    | { label: string; status: 'loading' }
    | { icon: IconSvgElement; label: string; status: 'empty' }
    | { label: string; onRetry: () => void; status: 'unavailable' };

export function ComputerDataGridState(props: ComputerDataGridStateProps) {
    return (
        <EmptyState
            aria-busy={props.status === 'loading' || undefined}
            className="flex h-full w-full flex-col items-center justify-center gap-4 text-center"
        >
            {props.status === 'loading' ? (
                <Spinner aria-hidden="true" color="current" size="sm" />
            ) : (
                <Icon
                    className="size-6 text-muted"
                    icon={props.status === 'empty' ? props.icon : AlertCircleIcon}
                />
            )}
            <span className="text-muted text-sm">{props.label}</span>
            {props.status === 'unavailable' ? (
                <Button onPress={props.onRetry} size="sm" variant="secondary">
                    Try again
                </Button>
            ) : null}
        </EmptyState>
    );
}
