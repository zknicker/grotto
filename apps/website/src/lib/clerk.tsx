import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { type ReactNode, useLayoutEffect, useState } from 'react';
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

/**
 * Current Clerk session token for API auth headers. clerk-js refreshes the
 * short-lived JWT internally; read it fresh per request, never cache it.
 */
export async function getClerkSessionToken(): Promise<string | null> {
    try {
        if (isClerkEnabled && usesNativeClerk()) {
            return await getNativeClerkSessionToken();
        }

        if (readReactClerkSessionToken) {
            return await readReactClerkSessionToken();
        }

        const clerk = (window as { Clerk?: ClerkGlobal }).Clerk;
        return (await clerk?.session?.getToken()) ?? null;
    } catch {
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
