import type { AlertVariants } from '@heroui/react';
import * as React from 'react';

const TOAST_DURATION_MS = 2400;

/** Matches HeroUI `Alert`'s `status` prop so consumers can pass it straight through. */
type SaveToastStatus = NonNullable<AlertVariants['status']>;

interface SaveToastState {
    message: string;
    status: SaveToastStatus;
}

export function useSaveToast() {
    const [toast, setToast] = React.useState<SaveToastState | null>(null);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = React.useCallback((status: SaveToastStatus, message: string) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setToast({ message, status });
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            setToast(null);
        }, TOAST_DURATION_MS);
    }, []);

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        showErrorToast: React.useCallback(
            (message: string) => {
                showToast('danger', message);
            },
            [showToast]
        ),
        showSuccessToast: React.useCallback(
            (message: string) => {
                showToast('success', message);
            },
            [showToast]
        ),
        toast,
    };
}
