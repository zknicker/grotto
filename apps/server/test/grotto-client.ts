import { appProtocolHeaders, appProtocolVersion } from '@tavern/api';
import {
    createTRPCClient,
    createWSClient,
    httpLink,
    splitLink,
    type TRPCClient,
    wsLink,
} from '@trpc/client';
import { WebSocket } from 'ws';
import type { GrottoRouter } from '../src/grotto-api/router.ts';
import type { GrottoServerHarness } from './grotto-server-harness.ts';

/**
 * Speaks the same wire the App speaks: HTTP for queries and mutations, the
 * tRPC WebSocket for subscriptions, with the Clerk session token attached
 * exactly as the App attaches it.
 */
export interface GrottoClient {
    clerkSessionToken: string | null;
    close(): void;
    trpc: TRPCClient<GrottoRouter>;
}

export interface GrottoClientOptions {
    /** Declared App protocol version; defaults to the exact current version. */
    protocolVersion?: number;
}

export function createGrottoClient(
    harness: GrottoServerHarness,
    clerkSessionToken: string | null = null,
    options: GrottoClientOptions = {}
): GrottoClient {
    const declaredProtocolVersion = options.protocolVersion ?? appProtocolVersion;
    const httpUrl = new URL('/trpc', harness.url).toString();
    const socketUrl = new URL('/trpc', harness.url);

    socketUrl.protocol = 'ws:';

    const wsClient = createWSClient({
        WebSocket: createOriginWebSocket(harness.appOrigin),
        connectionParams: () => ({
            appProtocolVersion: String(declaredProtocolVersion),
            ...(clerkSessionToken ? { clerkSessionToken } : {}),
            productVersion: 'test',
        }),
        url: socketUrl.toString(),
    });
    const headers = () => ({
        [appProtocolHeaders.productVersion]: 'test',
        [appProtocolHeaders.protocolVersion]: String(declaredProtocolVersion),
        ...(clerkSessionToken ? { authorization: `Bearer ${clerkSessionToken}` } : {}),
    });

    return {
        clerkSessionToken,
        close: () => wsClient.close(),
        trpc: createTRPCClient<GrottoRouter>({
            links: [
                splitLink({
                    condition: (operation) => operation.type === 'subscription',
                    false: httpLink({ headers, methodOverride: 'POST', url: httpUrl }),
                    true: wsLink({ client: wsClient }),
                }),
            ],
        }),
    };
}

function createOriginWebSocket(origin: string) {
    return class extends WebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols, { headers: { Origin: origin } });
        }
    } as unknown as typeof globalThis.WebSocket;
}
