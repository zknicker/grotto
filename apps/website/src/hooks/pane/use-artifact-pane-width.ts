import * as React from 'react';

// Shared width for the artifact pane. The toolbar tab segment and the pane
// body must track the same width live during a drag, so this is an external
// store rather than per-component state; commits persist to localStorage.
const storageKey = 'grotto.artifactPane.width';

export const artifactPaneWidthLimits = { default: 560, max: 880, min: 420 } as const;

let paneWidth = readInitialWidth();
const listeners = new Set<() => void>();

export function useArtifactPaneWidth() {
    const width = React.useSyncExternalStore(
        subscribe,
        () => paneWidth,
        () => artifactPaneWidthLimits.default
    );

    return { persistWidth, setWidth, width };
}

function setWidth(next: number) {
    paneWidth = clampWidth(next);
    for (const listener of listeners) {
        listener();
    }
}

function persistWidth(next: number) {
    setWidth(next);
    window.localStorage.setItem(storageKey, String(paneWidth));
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function readInitialWidth() {
    if (typeof window === 'undefined') {
        return artifactPaneWidthLimits.default;
    }
    const saved = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved > 0
        ? clampWidth(saved)
        : artifactPaneWidthLimits.default;
}

function clampWidth(width: number) {
    return Math.min(
        artifactPaneWidthLimits.max,
        Math.max(artifactPaneWidthLimits.min, Math.round(width))
    );
}
