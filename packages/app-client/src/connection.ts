export type ConnectionState = 'connected' | 'connecting' | 'reconnecting';

/** Reconciles active durable reads after reconnecting without refetching on initial connect. */
export function createQueryReconnectHandler({
    onReconnect,
    onStateChange,
}: {
    onReconnect: () => void;
    onStateChange: (state: ConnectionState) => void;
}) {
    let hasConnected = false;

    return (state: ConnectionState) => {
        onStateChange(state);
        if (state !== 'connected') {
            return;
        }
        if (hasConnected) {
            onReconnect();
            return;
        }
        hasConnected = true;
    };
}

export interface GrottoSessionWatch<TimerHandle> {
    clearTimer(handle: TimerHandle): void;
    intervalMs: number;
    onStaleSession(): void;
    readSessionToken(): Promise<string | null>;
    startTimer(run: () => void, intervalMs: number): TimerHandle;
}

/** Reconnects a socket when Clerk rotates the session token it opened with. */
export function watchGrottoSession<TimerHandle>(
    watch: GrottoSessionWatch<TimerHandle>
): () => void {
    let knownToken: string | null = null;
    let hasObserved = false;
    let isWatching = true;

    const readCurrentToken = () => {
        void watch.readSessionToken().then((token) => {
            if (!isWatching) {
                return;
            }

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
