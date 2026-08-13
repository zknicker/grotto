export interface GrottoSessionWatch {
    clearTimer(handle: number): void;
    intervalMs: number;
    onStaleSession(): void;
    readSessionToken(): Promise<string | null>;
    startTimer(run: () => void, intervalMs: number): number;
}

/**
 * A Server WebSocket presents the Clerk session it was opened with, so
 * an authenticated subscription would keep using an expiring token. Watch the
 * current session and reconnect when Clerk hands out a new one — the socket
 * re-reads its connection params on reconnect, and the Server keeps judging
 * every operation against a current token.
 */
export function watchGrottoSession(watch: GrottoSessionWatch): () => void {
    let knownToken: string | null = null;
    let hasObserved = false;
    let isWatching = true;

    const readCurrentToken = () => {
        void watch.readSessionToken().then((token) => {
            if (!isWatching) {
                return;
            }

            // The first read is the baseline. After that every identity change
            // needs a new connection: sign-out, late sign-in, and rotation
            // alike.
            const isStale = hasObserved && token !== knownToken;

            hasObserved = true;
            knownToken = token;

            if (isStale) {
                watch.onStaleSession();
            }
        });
    };
    const handle = watch.startTimer(readCurrentToken, watch.intervalMs);
    readCurrentToken();

    return () => {
        isWatching = false;
        watch.clearTimer(handle);
    };
}
