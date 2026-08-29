import * as React from 'react';

// Shared width for the app sidebar. The drag rail lives inside the Sidebar
// while the width token must be set above HeroUI's offcanvas wrapper (which
// declares its own `--sidebar-width`), so this is an external store both the
// rail and the AppLayout host read live during a drag; commits persist to
// localStorage.
const storageKey = 'grotto.appSidebar.width';

export const appSidebarWidthLimits = { default: 240, max: 360, min: 208 } as const;

let sidebarWidth = readInitialWidth();
let sidebarResizing = false;
const listeners = new Set<() => void>();

export function useAppSidebarWidth() {
    const width = React.useSyncExternalStore(
        subscribe,
        () => sidebarWidth,
        () => appSidebarWidthLimits.default
    );
    const resizing = React.useSyncExternalStore(
        subscribe,
        () => sidebarResizing,
        () => false
    );

    return { persistWidth, resizing, setResizing, setWidth, width };
}

function setWidth(next: number) {
    sidebarWidth = clampWidth(next);
    notify();
}

function persistWidth(next: number) {
    setWidth(next);
    window.localStorage.setItem(storageKey, String(sidebarWidth));
}

function setResizing(next: boolean) {
    sidebarResizing = next;
    notify();
}

function notify() {
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function readInitialWidth() {
    if (typeof window === 'undefined') {
        return appSidebarWidthLimits.default;
    }

    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) {
        return appSidebarWidthLimits.default;
    }

    const saved = Number(stored);

    return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : appSidebarWidthLimits.default;
}

function clampWidth(width: number) {
    return Math.min(
        appSidebarWidthLimits.max,
        Math.max(appSidebarWidthLimits.min, Math.round(width))
    );
}
