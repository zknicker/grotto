import { useAuth, useSignIn } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function DevAutoSignIn() {
    const shouldAutoSignIn =
        import.meta.env.DEV &&
        import.meta.env.VITE_DEV_CLERK_AUTO_SIGN_IN === 'true' &&
        isClerkEnabled;

    if (!shouldAutoSignIn) {
        return null;
    }

    return <DevAutoSignInInner />;
}

function DevAutoSignInInner() {
    const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
    const { isLoaded: isSignInLoaded, setActive, signIn } = useSignIn();
    const { mutateAsync: createClerkSignInToken } =
        grottoTrpc.dev.createClerkSignInToken.useMutation();
    const attemptedRef = useRef(false);

    useEffect(() => {
        if (!(isAuthLoaded && isSignInLoaded) || isSignedIn || attemptedRef.current) {
            return;
        }

        attemptedRef.current = true;

        const signInWithDevTicket = async () => {
            try {
                const { ticket } = await createClerkSignInToken();
                const attempt = await signIn.create({ strategy: 'ticket', ticket });

                if (attempt.status === 'complete') {
                    await setActive({ session: attempt.createdSessionId });
                }
            } catch (error) {
                console.error('[DevAutoSignIn] Automatic sign-in failed.', error);
            }
        };

        void signInWithDevTicket();
    }, [createClerkSignInToken, isAuthLoaded, isSignedIn, isSignInLoaded, setActive, signIn]);

    return null;
}
