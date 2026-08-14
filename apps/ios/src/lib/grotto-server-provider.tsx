import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    type ConnectionState,
    createGrottoRealtimeClient,
    createQueryReconnectHandler,
    grottoTrpc,
    queryClientDefaultOptions,
    reconnectGrottoRealtimeClient,
    watchGrottoSession,
} from '@tavern/app-client';
import { createContext, type ReactNode, use, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { appConfig } from './app-config';

const sessionWatchIntervalMs = 30_000;
const GrottoConnectionContext = createContext<ConnectionState>('connecting');

export function GrottoServerProvider({
    children,
    readSessionToken,
}: {
    children: ReactNode;
    readSessionToken: () => Promise<string | null>;
}) {
    const readTokenRef = useRef(readSessionToken);
    readTokenRef.current = readSessionToken;

    const [queryClient] = useState(
        () => new QueryClient({ defaultOptions: queryClientDefaultOptions })
    );
    const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
    const [handleConnectionState] = useState(() =>
        createQueryReconnectHandler({
            onReconnect: () => {
                void queryClient.invalidateQueries({ refetchType: 'active' });
            },
            onStateChange: setConnectionState,
        })
    );
    const [connection, setConnection] = useState<ReturnType<
        typeof createGrottoRealtimeClient
    > | null>(null);

    useEffect(() => {
        let active = true;
        const nextConnection = createGrottoRealtimeClient({
            onClose: () => {
                if (active) {
                    handleConnectionState('reconnecting');
                }
            },
            onOpen: () => {
                if (active) {
                    handleConnectionState('connected');
                }
            },
            origin: appConfig.serverOrigin,
            productVersion: appConfig.productVersion,
            readSessionToken: () => readTokenRef.current(),
        });
        setConnection(nextConnection);

        return () => {
            active = false;
            void nextConnection.wsClient.close();
        };
    }, [handleConnectionState]);

    useEffect(() => {
        if (!connection) {
            return;
        }

        return watchGrottoSession<ReturnType<typeof setInterval>>({
            clearTimer: clearInterval,
            intervalMs: sessionWatchIntervalMs,
            onStaleSession: () => reconnectGrottoRealtimeClient(connection.wsClient),
            readSessionToken: () => readTokenRef.current(),
            startTimer: setInterval,
        });
    }, [connection]);

    useEffect(() => {
        if (!connection) {
            return;
        }

        let previousState = AppState.currentState;
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active' && previousState !== 'active') {
                reconnectGrottoRealtimeClient(connection.wsClient);
            }
            previousState = nextState;
        });

        return () => subscription.remove();
    }, [connection]);

    if (!connection) {
        return null;
    }

    return (
        <GrottoConnectionContext value={connectionState}>
            <QueryClientProvider client={queryClient}>
                <grottoTrpc.Provider client={connection.client} queryClient={queryClient}>
                    {children}
                </grottoTrpc.Provider>
            </QueryClientProvider>
        </GrottoConnectionContext>
    );
}

export function useGrottoConnectionState() {
    return use(GrottoConnectionContext);
}
