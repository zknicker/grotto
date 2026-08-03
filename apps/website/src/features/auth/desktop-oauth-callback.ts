export function getDesktopOAuthReloadOptions(callbackUrl: string): { rotatingTokenNonce?: string } {
    const url = new URL(callbackUrl);
    const nonce = url.searchParams.get('rotating_token_nonce');

    return nonce ? { rotatingTokenNonce: nonce } : {};
}

export function waitForDesktopOAuthCallback({
    onCallback,
    signal,
    subscribe,
}: {
    onCallback: (callbackUrl: string) => Promise<void>;
    signal: AbortSignal;
    subscribe: (listener: (callbackUrl: string) => void) => () => void;
}): Promise<void> {
    return new Promise((resolve, reject) => {
        let active = true;
        let unsubscribe: null | (() => void) = null;

        const cleanup = () => {
            signal.removeEventListener('abort', handleAbort);
            unsubscribe?.();
        };
        const settle = (complete: () => void) => {
            if (!active) {
                return;
            }
            active = false;
            cleanup();
            complete();
        };
        const handleAbort = () => {
            const error = new Error('Google sign-in was canceled.');
            error.name = 'AbortError';
            settle(() => reject(error));
        };

        unsubscribe = subscribe((callbackUrl) => {
            if (!active) {
                return;
            }
            active = false;
            cleanup();
            void onCallback(callbackUrl).then(resolve, reject);
        });
        signal.addEventListener('abort', handleAbort, { once: true });

        if (signal.aborted) {
            handleAbort();
        }
    });
}
