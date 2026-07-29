export type DesktopUpdateBridgeStatus =
    | { phase: 'unsupported' }
    | { phase: 'checking' }
    | { phase: 'current' }
    | { phase: 'available'; version: string }
    | { phase: 'downloading'; progress: number; version: string }
    | { phase: 'ready'; version: string }
    | { phase: 'error'; message: string };

export type DesktopEditCommand = 'copy' | 'cut' | 'paste' | 'redo' | 'selectAll' | 'undo';

export interface TavernDesktopBridge {
    /** Read Clerk's native client JWT from main-process storage. */
    authTokenGet: () => Promise<string | null>;
    /** Persist or clear Clerk's native client JWT in main-process storage. */
    authTokenSet: (token: string | null) => Promise<void>;
    checkForUpdate: () => Promise<void>;
    closeWindow: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    getInfo: () => Promise<{ isPackaged: boolean; platform: NodeJS.Platform; version: string }>;
    /** This shell loads the canonical hosted App instead of a bundled renderer. */
    loadsHostedApp?: true;
    /** Main → renderer: the Developer menu toggled dev mode for this device. */
    onDevModeToggle?: (listener: () => void) => () => void;
    /** Main → renderer: the system browser returned Clerk's OAuth callback. */
    onSsoCallback: (listener: (url: string) => void) => () => void;
    onUpdateStatus: (listener: (status: DesktopUpdateBridgeStatus) => void) => () => void;
    /** Open an HTTP(S) URL in the operating system's default browser. */
    openExternal: (url: string) => Promise<void>;
    openWindow: (route: string) => Promise<void>;
    restartForUpdate: () => Promise<void>;
    runEditCommand: (command: DesktopEditCommand) => Promise<void>;
    setTheme: (theme: 'dark' | 'light' | null) => Promise<void>;
    startWindowDrag: () => Promise<void>;
}

export function getDesktopBridge() {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.tavernDesktop ?? null;
}

export function isElectronDesktopApp() {
    return getDesktopBridge() !== null;
}
