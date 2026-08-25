import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

/**
 * Dev mode reveals runtime internals in the UI — currently the raw prompt an
 * agent turn received, in the turn drawer. Toggled from the desktop app's
 * Developer menu; persisted per device.
 */

interface DevModeContextValue {
    devMode: boolean;
    setDevMode: (enabled: boolean) => void;
}

const storageKey = 'the-grotto-dev-mode';
const DevModeContext = createContext<DevModeContextValue | null>(null);

function getStoredDevMode(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.localStorage.getItem(storageKey) === 'on';
}

export function DevModeProvider({ children }: PropsWithChildren) {
    const [devMode, setDevModeState] = useState<boolean>(() => getStoredDevMode());

    const setDevMode = (enabled: boolean) => {
        window.localStorage.setItem(storageKey, enabled ? 'on' : 'off');
        setDevModeState(enabled);
    };

    useEffect(() => {
        const unsubscribe = window.grottoDesktop?.onDevModeToggle?.(() => {
            setDevModeState((current) => {
                const next = !current;
                window.localStorage.setItem(storageKey, next ? 'on' : 'off');
                return next;
            });
        });
        return unsubscribe;
    }, []);

    return (
        <DevModeContext.Provider value={{ devMode, setDevMode }}>
            {children}
        </DevModeContext.Provider>
    );
}

export function useDevMode() {
    const context = useContext(DevModeContext);
    if (!context) {
        throw new Error('useDevMode must be used within DevModeProvider');
    }
    return context;
}
