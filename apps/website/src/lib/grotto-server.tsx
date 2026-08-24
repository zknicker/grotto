import { appProtocolHeaders, appProtocolVersion } from '@grotto/api/app-protocol';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createWSClient,
    httpBatchLink,
    splitLink,
    type TRPCWebSocketClient,
    wsLink,
} from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import * as React from 'react';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { UpdateRequiredGate } from '../features/servers/update-required-gate.tsx';
import { getClerkSessionToken } from './clerk.tsx';
import { watchGrottoSession } from './grotto-session-refresh.ts';
import { queryClientDefaultOptions } from './query-policy.ts';
import { type ConnectionState, createQueryReconnectHandler } from './query-reconnect-recovery.ts';

/** The App's authenticated HTTP and WebSocket connection to Grotto Server. */
export const grottoTrpc = createTRPCReact<GrottoRouter>();

export type GrottoOutputs = inferRouterOutputs<GrottoRouter>;
export type GrottoInputs = inferRouterInputs<GrottoRouter>;
export type ServerSummary = GrottoOutputs['server']['list'][number];
export type ServerDetail = GrottoOutputs['server']['bySlug'];
export type GrottoServerConnectionState = ConnectionState;

const sessionWatchIntervalMs = 30_000;
// Provenance only; the build injects the App package version (see vite.config).
const productVersion = import.meta.env.VITE_GROTTO_PRODUCT_VERSION ?? '0.0.0-dev';
const GrottoServerConnectionContext =
    React.createContext<GrottoServerConnectionState>('connecting');

export function getGrottoServerOrigin(): string {
    return resolveGrottoServerOrigin(
        import.meta.env.VITE_GROTTO_SERVER_ORIGIN,
        globalThis.window?.location.origin,
        import.meta.env.DEV
    );
}

export function resolveGrottoServerOrigin(
    configuredOrigin: string | undefined,
    browserOrigin: string | undefined,
    allowDevelopmentOverride = false
): string {
    if (allowDevelopmentOverride) {
        const configuredUrl = parseHttpOrigin(configuredOrigin);
        if (configuredUrl) {
            return configuredUrl.origin;
        }
    }

    const browserUrl = parseHttpOrigin(browserOrigin);
    if (browserUrl) {
        return browserUrl.origin;
    }

    throw new Error(
        'The Grotto Server origin is unavailable. Open Grotto App over HTTP(S) or configure VITE_GROTTO_SERVER_ORIGIN for development.'
    );
}

function parseHttpOrigin(value: string | undefined) {
    if (!value) {
        return null;
    }
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
}

export function GrottoServerProvider({ children }: React.PropsWithChildren) {
    const [queryClient] = React.useState(
        () => new QueryClient({ defaultOptions: queryClientDefaultOptions })
    );
    const [connectionState, setConnectionState] =
        React.useState<GrottoServerConnectionState>('connecting');
    const [handleConnectionState] = React.useState(() =>
        createQueryReconnectHandler({
            onReconnect: () => {
                void queryClient.invalidateQueries({ refetchType: 'active' });
            },
            onStateChange: setConnectionState,
        })
    );
    const [connection, setConnection] = React.useState<GrottoConnection | null>(null);

    React.useEffect(() => {
        let active = true;
        const nextConnection = createGrottoConnection((state) => {
            if (active) {
                handleConnectionState(state);
            }
        });
        setConnection(nextConnection);

        return () => {
            active = false;
            void nextConnection.wsClient.close();
        };
    }, [handleConnectionState]);

    React.useEffect(() => {
        if (!connection) {
            return;
        }

        const stop = watchGrottoSession({
            clearTimer: (handle) => window.clearInterval(handle),
            intervalMs: sessionWatchIntervalMs,
            onStaleSession: () => reconnectGrottoSession(connection.wsClient),
            readSessionToken: getClerkSessionToken,
            startTimer: (run, intervalMs) => window.setInterval(run, intervalMs),
        });

        return stop;
    }, [connection]);

    if (!connection) {
        return null;
    }

    return (
        <GrottoServerConnectionContext value={connectionState}>
            <QueryClientProvider client={queryClient}>
                <grottoTrpc.Provider client={connection.client} queryClient={queryClient}>
                    <UpdateRequiredGate queryClient={queryClient}>{children}</UpdateRequiredGate>
                </grottoTrpc.Provider>
            </QueryClientProvider>
        </GrottoServerConnectionContext>
    );
}

/** One stable tRPC client whose websocket re-authenticates in place. */
function createGrottoConnection(
    onConnectionState: (state: GrottoServerConnectionState) => void
): GrottoConnection {
    const origin = getGrottoServerOrigin();
    const httpUrl = new URL('/trpc', origin).toString();
    const socketUrl = new URL('/trpc', origin);

    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    const wsClient = createWSClient({
        connectionParams: async () => {
            const token = await getClerkSessionToken();
            return {
                appProtocolVersion: String(appProtocolVersion),
                ...(token ? { clerkSessionToken: token } : {}),
                productVersion,
            };
        },
        onClose: () => onConnectionState('reconnecting'),
        onOpen: () => onConnectionState('connected'),
        url: socketUrl.toString(),
    });

    return {
        client: grottoTrpc.createClient({
            links: [
                splitLink({
                    condition: (operation) => operation.type === 'subscription',
                    // Batched: a screen's concurrent queries share one POST, so
                    // a cold chat open costs one round trip, not five.
                    false: httpBatchLink({
                        headers: async () => {
                            const token = await getClerkSessionToken();
                            return {
                                [appProtocolHeaders.productVersion]: productVersion,
                                [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
                                ...(token ? { authorization: `Bearer ${token}` } : {}),
                            };
                        },
                        methodOverride: 'POST',
                        url: httpUrl,
                    }),
                    true: wsLink({ client: wsClient }),
                }),
            ],
        }),
        wsClient,
    };
}

interface GrottoConnection {
    client: ReturnType<typeof grottoTrpc.createClient>;
    wsClient: TRPCWebSocketClient;
}

/** Re-authenticate the transport without replacing its tRPC or React providers. */
function reconnectGrottoSession(wsClient: TRPCWebSocketClient) {
    wsClient.connection?.ws?.close();
}

export function useGrottoServerConnectionState() {
    return React.use(GrottoServerConnectionContext);
}
