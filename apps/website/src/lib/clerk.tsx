import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { type ReactNode, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { getNativeClerk, getNativeClerkSessionToken } from './clerk-native.ts';
import { clerkNativeOptions } from './clerk-native-options.ts';
import { isElectronDesktopApp } from './desktop-bridge.ts';

export const clerkPublishableKey: string | null =
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || null;

// Sign-in is optional in local dev and e2e: without a key the app runs signed-out.
export const isClerkEnabled = clerkPublishableKey !== null;

interface ClerkGlobal {
    session?: { getToken(): Promise<string | null> } | null;
}

let readReactClerkSessionToken: (() => Promise<string | null>) | null = null;
let clerkSessionTokenState: ClerkSessionTokenState = 'unknown';
const clerkSessionTokenListeners = new Set<() => void>();

export type ClerkSessionTokenState = 'missing' | 'ready' | 'unknown';

/**
 * Current Clerk session token for API auth headers. clerk-js refreshes the
 * short-lived JWT internally; read it fresh per request, never cache it.
 */
export async function getClerkSessionToken(): Promise<string | null> {
    if (isClerkEnabled && usesNativeClerk()) {
        return await resolveClerkSessionToken(getNativeClerkSessionToken);
    }

    if (readReactClerkSessionToken) {
        return await resolveClerkSessionToken(readReactClerkSessionToken);
    }

    const clerk = (window as { Clerk?: ClerkGlobal }).Clerk;
    return await resolveClerkSessionToken(async () => (await clerk?.session?.getToken()) ?? null);
}

export function useClerkSessionTokenState() {
    return useSyncExternalStore(
        subscribeToClerkSessionTokenState,
        readClerkSessionTokenState,
        readClerkSessionTokenState
    );
}

export async function resolveClerkSessionToken(
    readToken: () => Promise<string | null>
): Promise<string | null> {
    try {
        const token = await readToken();
        updateClerkSessionTokenState(token ? 'ready' : 'missing');
        return token;
    } catch {
        updateClerkSessionTokenState('missing');
        return null;
    }
}

export function TavernClerkProvider({ children }: { children: ReactNode }) {
    if (!clerkPublishableKey) {
        return children;
    }

    if (usesNativeClerk()) {
        return (
            <ClerkProvider
                Clerk={getNativeClerk(clerkPublishableKey)}
                publishableKey={clerkPublishableKey}
                {...clerkNativeOptions}
            >
                {children}
            </ClerkProvider>
        );
    }

    return (
        <ClerkProvider afterSignOutUrl="/" publishableKey={clerkPublishableKey}>
            <ClerkSessionTokenBridge>{children}</ClerkSessionTokenBridge>
        </ClerkProvider>
    );
}

function ClerkSessionTokenBridge({ children }: { children: ReactNode }) {
    const { getToken } = useAuth();
    const [ready, setReady] = useState(false);

    useLayoutEffect(() => {
        readReactClerkSessionToken = getToken;
        setReady(true);
        return () => {
            readReactClerkSessionToken = null;
        };
    }, [getToken]);

    return ready ? children : null;
}

function usesNativeClerk() {
    return isElectronDesktopApp() && !import.meta.env.DEV;
}

export function readClerkSessionTokenState() {
    return clerkSessionTokenState;
}

export function subscribeToClerkSessionTokenState(listener: () => void) {
    clerkSessionTokenListeners.add(listener);
    return () => clerkSessionTokenListeners.delete(listener);
}

function updateClerkSessionTokenState(state: ClerkSessionTokenState) {
    if (clerkSessionTokenState === state) {
        return;
    }
    clerkSessionTokenState = state;
    for (const listener of clerkSessionTokenListeners) {
        listener();
    }
}
