import { ClerkFailed, ClerkLoaded, ClerkLoading, useAuth, useClerk } from '@clerk/clerk-react';
import { Button, Spinner } from '@heroui/react';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivationShell, ActivationStep } from '../../components/activation/activation-shell.tsx';
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
                <SignInGateFrame />
            </ClerkLoading>
            <ClerkFailed>
                <SignInGateFrame signIn />
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
        return <SignInGateFrame signIn={isLoaded} />;
    }

    if (tokenState === 'loading') {
        return <SignInGateFrame />;
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
            <SignInSessionRecovery
                onRetry={() => setRetryKey((key) => key + 1)}
                onSignOut={signInAgain}
            />
        );
    }

    return children;
}

/** The signed-in-but-unusable-session repair screen. */
export function SignInSessionRecovery({
    onRetry,
    onSignOut,
}: {
    onRetry: () => void;
    onSignOut: () => void;
}) {
    return (
        <SignInGateFrame
            message="We couldn’t open your signed-in session."
            recovery={
                <>
                    <Button onPress={onRetry}>Try again</Button>
                    <Button onPress={onSignOut} variant="outline">
                        Sign in again
                    </Button>
                </>
            }
        />
    );
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

export function SignInGateFrame({
    message = 'Sign in to open your Grotto.',
    recovery,
    signIn = false,
}: {
    message?: string;
    recovery?: ReactNode;
    signIn?: boolean;
}) {
    return (
        <ActivationShell>
            <ActivationStep
                description={message}
                footer={
                    recovery ??
                    (signIn ? (
                        <SignInAction />
                    ) : (
                        <Spinner aria-label="Opening your session" size="sm" />
                    ))
                }
                title="Welcome to Grotto"
            />
        </ActivationShell>
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
