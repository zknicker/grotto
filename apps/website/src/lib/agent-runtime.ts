import { isElectronDesktopApp } from './desktop-bridge.ts';

/** Legacy callers resolve the Server too; Electron never launches one. */
export function isPackagedDesktopApp() {
    return (
        isElectronDesktopApp() &&
        typeof window !== 'undefined' &&
        window.location.protocol === 'file:'
    );
}

export function getConfiguredServerOrigin() {
    return import.meta.env.VITE_SERVER_ORIGIN ?? import.meta.env.VITE_GROTTO_SERVER_ORIGIN ?? null;
}

export function getTavernRuntimeOrigin() {
    return getConfiguredServerOrigin() ?? window.location.origin;
}

export async function ensureDesktopServerOrigin() {
    return getConfiguredServerOrigin() ?? '';
}
