import { ClerkFailed, ClerkLoaded, ClerkLoading, useAuth, useClerk } from '@clerk/clerk-react';
import { Button } from '@heroui/react';
import { type ReactNode, useEffect, useState } from 'react';
import {
    getClerkSessionToken,
    isClerkEnabled,
    useClerkSessionTokenState,
} from '../../lib/clerk.tsx';
import { isElectronDesktopApp } from '../../lib/desktop-bridge.ts';
import { useDesktopOAuth } from './use-desktop-oauth.ts';

/**
 * Mandatory sign-in (specs/identity.md): with Clerk configured, the app
 * renders only for a signed-in user. Keyless test builds skip the gate, but a
 * configured hosted App never falls through to authenticated Server routes
 * without a Clerk session.
 */
export function SignInGate({ children }: { children: ReactNode }) {
    if (!isClerkEnabled) {
        return children;
    }

    if (window.location.pathname === '/sso-callback') {
        return children;
    }

    return (
        <>
            <ClerkLoading>
                <GateFrame />
            </ClerkLoading>
            <ClerkFailed>
                <GateFrame signIn />
            </ClerkFailed>
            {/* ClerkLoaded also covers the degraded status (degraded implies
                loaded). The session gate also requires the token used by the
                Server client, so stale Clerk UI state cannot open signed API
                routes without usable authentication. */}
            <ClerkLoaded>
                <ClerkSessionGate>{children}</ClerkSessionGate>
            </ClerkLoaded>
        </>
    );
}

function ClerkSessionGate({ children }: { children: ReactNode }) {
    const { isLoaded, isSignedIn } = useAuth();
    const clerk = useClerk();
    const refreshState = useClerkSessionTokenState();
    const [tokenState, setTokenState] = useState<ClerkSessionTokenState>('loading');
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        // The retry key intentionally starts a fresh token read.
        void retryKey;
        let active = true;

        if (!(isLoaded && isSignedIn)) {
            setTokenState('missing');
            return;
        }

        setTokenState('loading');
        void readClerkSessionToken(getClerkSessionToken).then((state) => {
            if (active) {
                setTokenState(state);
            }
        });

        return () => {
            active = false;
        };
    }, [isLoaded, isSignedIn, retryKey]);

    if (!(isLoaded && isSignedIn)) {
        return <GateFrame signIn={isLoaded} />;
    }

    if (tokenState === 'loading') {
        return <GateFrame />;
    }

    if (tokenState === 'missing' || refreshState === 'missing') {
        const signInAgain = () => {
            if (isElectronDesktopApp()) {
                void clerk.signOut(() => undefined);
                return;
            }
            void clerk.signOut();
        };

        return (
            <GateFrame
                message="We couldn’t open your signed-in session."
                recovery={
                    <>
                        <Button onPress={() => setRetryKey((key) => key + 1)}>Try again</Button>
                        <Button onPress={signInAgain} variant="outline">
                            Sign in again
                        </Button>
                    </>
                }
            />
        );
    }

    return children;
}

type ClerkSessionTokenState = 'loading' | 'ready' | 'missing';

export async function readClerkSessionToken(
    getToken: () => Promise<string | null>
): Promise<ClerkSessionTokenState> {
    try {
        return (await getToken()) ? 'ready' : 'missing';
    } catch {
        return 'missing';
    }
}

function GateFrame({
    message = 'Sign in to open your Grotto.',
    recovery,
    signIn = false,
}: {
    message?: string;
    recovery?: ReactNode;
    signIn?: boolean;
}) {
    return (
        <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background">
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="font-semibold text-2xl text-foreground">Welcome to Grotto</h1>
                <p className="max-w-sm text-muted text-sm">{message}</p>
            </div>
            {recovery ? <div className="flex items-center gap-2">{recovery}</div> : null}
            {signIn ? <SignInAction /> : null}
        </div>
    );
}

/**
 * Clerk's `SignInButton` drives its child through a cloned `onClick`, which
 * HeroUI's Button (React Aria) deliberately drops in favour of `onPress`. The
 * modal is opened directly instead — the same call `SignInButton mode="modal"`
 * makes.
 */
function SignInAction() {
    const clerk = useClerk();

    if (isElectronDesktopApp()) {
        return <DesktopGoogleSignIn />;
    }

    return <Button onPress={() => clerk.openSignIn()}>Sign in</Button>;
}

function DesktopGoogleSignIn() {
    const { cancelGoogleSignIn, startGoogleSignIn } = useDesktopOAuth();
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    const handleSignIn = async () => {
        setError(null);
        setIsStarting(true);

        try {
            await startGoogleSignIn();
        } catch (signInError) {
            if (!(signInError instanceof Error && signInError.name === 'AbortError')) {
                setError(getErrorMessage(signInError));
            }
        } finally {
            setIsStarting(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
                <Button
                    isPending={isStarting}
                    onPress={() => {
                        void handleSignIn();
                    }}
                >
                    {isStarting ? 'Waiting for Google…' : 'Continue with Google'}
                </Button>
                {isStarting ? (
                    <Button onPress={cancelGoogleSignIn} variant="outline">
                        Cancel
                    </Button>
                ) : null}
            </div>
            {error ? <p className="max-w-sm text-center text-danger text-sm">{error}</p> : null}
        </div>
    );
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
}
