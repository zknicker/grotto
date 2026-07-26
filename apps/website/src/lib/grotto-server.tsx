import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWSClient, httpLink, splitLink, wsLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import * as React from 'react';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { getClerkSessionToken } from './clerk.tsx';
import { watchGrottoSession } from './grotto-session-refresh.ts';
import { queryClientDefaultOptions } from './query-policy.ts';

/**
 * The App's direct connection to the hosted Grotto Server. It is separate from
 * the pre-WS6 local sidecar client on purpose: a different origin, a different
 * contract, and Clerk identity attached per request and per connection.
 */
export const grottoTrpc = createTRPCReact<GrottoRouter>();

export type GrottoOutputs = inferRouterOutputs<GrottoRouter>;
export type GrottoInputs = inferRouterInputs<GrottoRouter>;
export type ServerSummary = GrottoOutputs['server']['list'][number];
export type ServerDetail = GrottoOutputs['server']['bySlug'];

const sessionWatchIntervalMs = 30_000;

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
        'The Grotto Server origin is unavailable. Open the hosted App over HTTP(S) or configure VITE_GROTTO_SERVER_ORIGIN for development.'
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
    // A socket presents the Clerk session it was opened with. When Clerk hands
    // out a new one, open the next connection and re-register subscriptions
    // against it. Query data lives in the shared cache, so the swap is silent.
    const [connection, setConnection] = React.useState(() => createGrottoConnection(0));

    React.useEffect(() => {
        const stop = watchGrottoSession({
            clearTimer: (handle) => window.clearInterval(handle),
            intervalMs: sessionWatchIntervalMs,
            onStaleSession: () =>
                setConnection((current) => createGrottoConnection(current.generation + 1)),
            readSessionToken: getClerkSessionToken,
            startTimer: (run, intervalMs) => window.setInterval(run, intervalMs),
        });

        return () => {
            stop();
            void connection.wsClient.close();
        };
    }, [connection]);

    return (
        <QueryClientProvider client={queryClient}>
            <grottoTrpc.Provider
                client={connection.client}
                key={connection.generation}
                queryClient={queryClient}
            >
                {children}
            </grottoTrpc.Provider>
        </QueryClientProvider>
    );
}

/** One connection to the hosted Server; `generation` counts session renewals. */
function createGrottoConnection(generation: number) {
    const origin = getGrottoServerOrigin();
    const httpUrl = new URL('/trpc', origin).toString();
    const socketUrl = new URL('/trpc', origin);

    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    const wsClient = createWSClient({
        connectionParams: async () => {
            const token = await getClerkSessionToken();
            return token ? { clerkSessionToken: token } : {};
        },
        url: socketUrl.toString(),
    });

    return {
        client: grottoTrpc.createClient({
            links: [
                splitLink({
                    condition: (operation) => operation.type === 'subscription',
                    false: httpLink({
                        headers: async () => {
                            const token = await getClerkSessionToken();
                            return token ? { authorization: `Bearer ${token}` } : {};
                        },
                        methodOverride: 'POST',
                        url: httpUrl,
                    }),
                    true: wsLink({ client: wsClient }),
                }),
            ],
        }),
        generation,
        wsClient,
    };
}
