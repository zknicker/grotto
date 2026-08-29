import * as React from 'react';

// Shared width for the artifact pane. The toolbar tab segment and the pane
// body must track the same width live during a drag, so this is an external
// store rather than per-component state. Deliberately session-only: how much
// room an artifact needs is situational, so the pane starts fresh at its
// default on every app launch. The app sidebar's width is the one that
// persists (use-app-sidebar-width.ts) — it is a workspace-shape preference.
const legacyStorageKey = 'grotto.artifactPane.width';

export const artifactPaneWidthLimits = { default: 560, max: 880, min: 420 } as const;

let paneWidth: number = artifactPaneWidthLimits.default;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
    // Widths persisted before the pane became session-only.
    window.localStorage.removeItem(legacyStorageKey);
}

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

// Commit is just the final width of a drag — nothing outlives the session.
function persistWidth(next: number) {
    setWidth(next);
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function clampWidth(width: number) {
    return Math.min(
        artifactPaneWidthLimits.max,
        Math.max(artifactPaneWidthLimits.min, Math.round(width))
    );
}
