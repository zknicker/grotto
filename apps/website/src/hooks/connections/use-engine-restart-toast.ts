import { toast } from '@heroui/react';
import { useEffect, useRef } from 'react';
import { trpc } from '../../lib/trpc.tsx';

const restartTimeoutMs = 120_000;

export type EngineRestartToastAction = 'complete' | 'ignore' | 'start';

/**
 * One loading toast per engine restart cycle: settings saves that need a
 * restart raise it ("Applying settings"), and it is replaced when the engine
 * reports the restart completed. Bursts share a single toast, matching the
 * restart coordinator's coalescing.
 */
export function useEngineRestartToast() {
    const pending = useRef<{ finish: () => void } | null>(null);

    useEffect(
        () => () => {
            pending.current?.finish();
            pending.current = null;
        },
        []
    );

    trpc.agent.onEngineRestart.useSubscription(undefined, {
        onData: (event) => {
            const phase = typeof event.phase === 'string' ? event.phase : '';
            const action = engineRestartToastAction(pending.current !== null, phase);

            if (action === 'complete') {
                pending.current?.finish();
                pending.current = null;
                return;
            }
            if (action !== 'start') {
                return;
            }

            const toastId = toast('Applying settings', {
                description: 'restarting the agent engine…',
                isLoading: true,
                timeout: 0,
            });
            const timeout = setTimeout(() => {
                if (pending.current) {
                    pending.current = null;
                    toast.close(toastId);
                    toast.danger('Still restarting', {
                        description: 'settings apply when the engine returns',
                    });
                }
            }, restartTimeoutMs);

            pending.current = {
                finish: () => {
                    clearTimeout(timeout);
                    toast.close(toastId);
                    toast.success('Settings applied');
                },
            };
        },
    });
}

/** Pure phase handling: one toast per cycle, completed resolves it. */
export function engineRestartToastAction(
    hasPendingToast: boolean,
    phase: string
): EngineRestartToastAction {
    if (phase === 'completed') {
        return hasPendingToast ? 'complete' : 'ignore';
    }
    if (phase === 'scheduled' || phase === 'restarting') {
        return hasPendingToast ? 'ignore' : 'start';
    }
    return 'ignore';
}
