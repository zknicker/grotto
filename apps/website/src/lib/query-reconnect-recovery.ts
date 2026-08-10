export type ConnectionState = 'connected' | 'connecting' | 'reconnecting';

/** Reconciles active durable reads after a websocket gap, never on the initial connection. */
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
