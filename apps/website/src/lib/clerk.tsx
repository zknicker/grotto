import { ClerkProvider } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
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

/**
 * Current Clerk session token for API auth headers. clerk-js refreshes the
 * short-lived JWT internally; read it fresh per request, never cache it.
 */
export async function getClerkSessionToken(): Promise<string | null> {
    try {
        if (isClerkEnabled && isElectronDesktopApp()) {
            return await getNativeClerkSessionToken();
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

    if (isElectronDesktopApp()) {
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
            {children}
        </ClerkProvider>
    );
}
