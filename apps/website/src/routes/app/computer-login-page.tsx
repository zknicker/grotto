import {
    ClerkFailed,
    ClerkLoaded,
    ClerkLoading,
    useAuth,
    useClerk,
    useUser,
} from '@clerk/clerk-react';
import * as React from 'react';
import {
    ComputerLoginApproval,
    LoginFrame,
} from '../../features/computers/computer-login-view.tsx';
import { getClerkSessionToken, isClerkEnabled } from '../../lib/clerk.tsx';

export function ComputerLoginPage() {
    return isClerkEnabled ? <ClerkComputerLoginPage /> : <KeylessComputerLoginPage />;
}

function ClerkComputerLoginPage() {
    return (
        <>
            <ClerkLoading>
                <LoginFrame
                    description="Opening your sign-in session…"
                    title="Sign in Grotto Computer"
                />
            </ClerkLoading>
            <ClerkFailed>
                <LoginFrame
                    description="Grotto could not open sign-in. Reload this page and try again."
                    title="Sign-in unavailable"
                />
            </ClerkFailed>
            <ClerkLoaded>
                <ClerkComputerLoginContent />
            </ClerkLoaded>
        </>
    );
}

function ClerkComputerLoginContent() {
    const { isLoaded, isSignedIn } = useAuth();
    const clerk = useClerk();
    const { user } = useUser();

    if (!isLoaded) {
        return (
            <LoginFrame
                description="Opening your sign-in session…"
                title="Sign in Grotto Computer"
            />
        );
    }

    const accountLabel =
        user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'your Clerk account';
    return (
        <ComputerLoginApproval
            accountLabel={isSignedIn ? accountLabel : null}
            onSignIn={() => void clerk.openSignIn({})}
            onSwitchAccount={() => void clerk.signOut({ redirectUrl: window.location.href })}
            signedIn={Boolean(isSignedIn)}
        />
    );
}

function KeylessComputerLoginPage() {
    const [signedIn, setSignedIn] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        let active = true;
        void getClerkSessionToken().then((token) => {
            if (active) {
                setSignedIn(Boolean(token));
            }
        });
        return () => {
            active = false;
        };
    }, []);

    if (signedIn === null) {
        return (
            <LoginFrame
                description="Checking your sign-in session…"
                title="Sign in Grotto Computer"
            />
        );
    }

    return (
        <ComputerLoginApproval
            accountLabel={signedIn ? 'your current Clerk account' : null}
            onSignIn={undefined}
            onSwitchAccount={undefined}
            signedIn={signedIn}
        />
    );
}
