import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDesktopBridge } from '../../lib/desktop-bridge.ts';

/**
 * Navigates the current server's surfaces when the native menu asks:
 * Settings… (⌘,) and Edit > Find… (⌘F). Mounted in ServerLayout because both
 * destinations are server-scoped routes; outside a server they no-op.
 */
export function useDesktopMenuNavigation(routes: { searchRoute: string; settingsRoute: string }) {
    const navigate = useNavigate();

    useEffect(
        () =>
            getDesktopBridge()?.onOpenSettings?.(() => {
                navigate(routes.settingsRoute);
            }),
        [navigate, routes.settingsRoute]
    );

    useEffect(
        () =>
            getDesktopBridge()?.onOpenSearch?.(() => {
                navigate(routes.searchRoute);
            }),
        [navigate, routes.searchRoute]
    );
}

/** Go menu (⌘[ / ⌘]) and macOS page swipes drive router history. */
export function useDesktopHistoryNavigation() {
    const navigate = useNavigate();

    useEffect(
        () =>
            getDesktopBridge()?.onHistoryNavigate?.((direction) => {
                navigate(direction === 'back' ? -1 : 1);
            }),
        [navigate]
    );
}
