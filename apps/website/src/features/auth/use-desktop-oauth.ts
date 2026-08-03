import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { useCallback, useEffect, useRef } from 'react';
import { getDesktopBridge, isElectronDesktopApp } from '../../lib/desktop-bridge.ts';
import {
    getDesktopOAuthReloadOptions,
    waitForDesktopOAuthCallback,
} from './desktop-oauth-callback.ts';
import { desktopGoogleOAuthRequest, getDesktopOAuthCallbackUrl } from './desktop-oauth-request.ts';

export function useDesktopOAuth() {
    const { isLoaded: isSignInLoaded, setActive, signIn } = useSignIn();
    const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortControllerRef.current?.abort(), []);

    const startGoogleSignIn = useCallback(async () => {
        if (!(isSignInLoaded && isSignUpLoaded)) {
            throw new Error('Sign in is still loading.');
        }

        if (!isElectronDesktopApp()) {
            await signIn.authenticateWithRedirect({
                redirectUrl: `${window.location.origin}/sso-callback`,
                redirectUrlComplete: '/',
                strategy: 'oauth_google',
            });
            return;
        }

        const bridge = getDesktopBridge();
        if (!bridge) {
            throw new Error('The Grotto desktop bridge is unavailable.');
        }

        abortControllerRef.current?.abort();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const callbackUrl = await getDesktopOAuthCallbackUrl(bridge);
            await signIn.create(desktopGoogleOAuthRequest(callbackUrl));

            const redirectUrl = signIn.firstFactorVerification.externalVerificationRedirectURL;
            if (!redirectUrl) {
                throw new Error('Google sign-in did not return an authorization URL.');
            }
            await bridge.openExternal(redirectUrl.toString());

            await waitForDesktopOAuthCallback({
                onCallback: async (callbackUrl) => {
                    await signIn.reload(getDesktopOAuthReloadOptions(callbackUrl));

                    let createdSessionId: string | null = null;
                    if (signIn.status === 'complete') {
                        createdSessionId = signIn.createdSessionId;
                    } else if (signIn.firstFactorVerification.status === 'transferable') {
                        await signUp.create({ transfer: true });
                        createdSessionId = signUp.createdSessionId;
                    }

                    if (!createdSessionId) {
                        throw new Error(
                            'Google sign-in requires an unsupported verification step.'
                        );
                    }

                    await setActive({ session: createdSessionId });
                },
                signal: abortController.signal,
                subscribe: bridge.onSsoCallback,
            });
        } finally {
            await bridge.cancelSsoCallback?.().catch(() => undefined);
            if (abortControllerRef.current === abortController) {
                abortControllerRef.current = null;
            }
        }
    }, [isSignInLoaded, isSignUpLoaded, setActive, signIn, signUp]);

    const cancelGoogleSignIn = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    return { cancelGoogleSignIn, startGoogleSignIn };
}
