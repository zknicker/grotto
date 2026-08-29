import * as React from 'react';
import type { ComputerUpdateComputer } from '../computers/computer-update-card.tsx';
import { computerLabel } from '../computers/presentation.ts';
import { expectedComputerRestartMs, offlineComputerNoticeDelayMs } from './grotto-update-timing.ts';

export interface OfflineComputerNotice {
    id: string;
    lastConnectedAt: string | null;
    name: string;
}

export function useOfflineComputers(
    computers: readonly ComputerUpdateComputer[]
): OfflineComputerNotice[] {
    const latest = React.useRef(computers);
    const timers = React.useRef(new Map<string, number>());
    const visibleIds = React.useRef(new Set<string>());
    const [refreshedAt, render] = React.useReducer(() => Date.now(), Date.now());
    latest.current = computers;

    React.useEffect(() => {
        const observedAt = Math.max(refreshedAt, Date.now());
        const candidates = computers.filter((computer) =>
            isOfflineComputerNoticeCandidate(computer, observedAt)
        );
        const candidateIds = new Set(candidates.map((computer) => computer.id));

        for (const [id, timer] of timers.current) {
            if (!candidateIds.has(id)) {
                window.clearTimeout(timer);
                timers.current.delete(id);
            }
        }
        let visibilityChanged = false;
        for (const id of visibleIds.current) {
            if (!candidateIds.has(id)) {
                visibleIds.current.delete(id);
                visibilityChanged = true;
            }
        }
        if (visibilityChanged) {
            render();
        }
        for (const computer of candidates) {
            if (visibleIds.current.has(computer.id) || timers.current.has(computer.id)) {
                continue;
            }
            const timer = window.setTimeout(() => {
                timers.current.delete(computer.id);
                const current = latest.current.find((item) => item.id === computer.id);
                if (current && isOfflineComputerNoticeCandidate(current, Date.now())) {
                    visibleIds.current.add(computer.id);
                    render();
                }
            }, offlineComputerNoticeDelayMs);
            timers.current.set(computer.id, timer);
        }

        const restartExpiry = nextRestartExpiry(computers, observedAt);
        if (restartExpiry === null) {
            return;
        }
        const wake = window.setTimeout(render, Math.max(0, restartExpiry - observedAt));
        return () => window.clearTimeout(wake);
    }, [computers, refreshedAt]);

    React.useEffect(
        () => () => {
            for (const timer of timers.current.values()) {
                window.clearTimeout(timer);
            }
            timers.current.clear();
        },
        []
    );

    return computers
        .filter((computer) => visibleIds.current.has(computer.id))
        .map((computer) => ({
            id: computer.id,
            lastConnectedAt: computer.lastConnectedAt,
            name: computerLabel(computer),
        }));
}

export function isOfflineComputerNoticeCandidate(
    computer: Pick<ComputerUpdateComputer, 'health' | 'updatePhase' | 'updateUpdatedAt'>,
    observedAt: number
) {
    if (computer.health !== 'offline') {
        return false;
    }
    if (computer.updatePhase !== 'restarting') {
        return true;
    }
    if (!computer.updateUpdatedAt) {
        return true;
    }
    return observedAt - new Date(computer.updateUpdatedAt).getTime() >= expectedComputerRestartMs;
}

function nextRestartExpiry(computers: readonly ComputerUpdateComputer[], observedAt: number) {
    const expiries = computers.flatMap((computer) => {
        if (
            computer.health !== 'offline' ||
            computer.updatePhase !== 'restarting' ||
            !computer.updateUpdatedAt
        ) {
            return [];
        }
        const expiry = new Date(computer.updateUpdatedAt).getTime() + expectedComputerRestartMs;
        return expiry > observedAt ? [expiry] : [];
    });
    return expiries.length > 0 ? Math.min(...expiries) : null;
}
