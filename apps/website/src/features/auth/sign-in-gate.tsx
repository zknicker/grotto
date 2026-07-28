import {
    ClerkFailed,
    ClerkLoaded,
    ClerkLoading,
    SignInButton,
    useAuth,
    useClerk,
} from '@clerk/clerk-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { isClerkEnabled } from '../../lib/clerk.tsx';
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
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const clerk = useClerk();
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
        void readClerkSessionToken(getToken).then((state) => {
            if (active) {
                setTokenState(state);
            }
        });

        return () => {
            active = false;
        };
    }, [getToken, isLoaded, isSignedIn, retryKey]);

    if (!(isLoaded && isSignedIn)) {
        return <GateFrame signIn={isLoaded} />;
    }

    if (tokenState === 'loading') {
        return <GateFrame />;
    }

    if (tokenState === 'missing') {
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
                        <Button onClick={() => setRetryKey((key) => key + 1)}>Try again</Button>
                        <Button onClick={signInAgain} variant="outline">
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
                <p className="max-w-sm text-muted-foreground text-sm">{message}</p>
            </div>
            {recovery ? <div className="flex items-center gap-2">{recovery}</div> : null}
            {signIn ? <SignInAction /> : null}
        </div>
    );
}

function SignInAction() {
    if (isElectronDesktopApp()) {
        return <DesktopGoogleSignIn />;
    }

    return (
        <SignInButton mode="modal">
            <Button>Sign in</Button>
        </SignInButton>
    );
}

function DesktopGoogleSignIn() {
    const { startGoogleSignIn } = useDesktopOAuth();
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    const handleSignIn = async () => {
        setError(null);
        setIsStarting(true);

        try {
            await startGoogleSignIn();
        } catch (signInError) {
            setError(getErrorMessage(signInError));
        } finally {
            setIsStarting(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <Button disabled={isStarting} onClick={handleSignIn}>
                {isStarting ? 'Opening Google…' : 'Continue with Google'}
            </Button>
            {error ? (
                <p className="max-w-sm text-center text-destructive text-sm">{error}</p>
            ) : null}
        </div>
    );
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
}
