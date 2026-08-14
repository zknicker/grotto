/// <reference path="./assets.d.ts" />

import { appProtocolHeaders, appProtocolVersion } from '@tavern/api/app-protocol';
import type { GrottoRouter } from '@tavern/server/grotto-router';
import {
    createWSClient,
    httpBatchLink,
    splitLink,
    type TRPCWebSocketClient,
    wsLink,
} from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

export const grottoTrpc = createTRPCReact<GrottoRouter>();

export type GrottoInputs = inferRouterInputs<GrottoRouter>;
export type GrottoOutputs = inferRouterOutputs<GrottoRouter>;
export type ServerDetail = GrottoOutputs['server']['bySlug'];
export type ServerSummary = GrottoOutputs['server']['list'][number];

export function createGrottoHttpClient({
    origin,
    productVersion,
    readSessionToken,
}: {
    origin: string;
    productVersion: string;
    readSessionToken: () => Promise<string | null>;
}) {
    return grottoTrpc.createClient({
        links: [
            createHttpLink({
                productVersion,
                readSessionToken,
                url: new URL('/trpc', origin).toString(),
            }),
        ],
    });
}

export function createGrottoRealtimeClient({
    onClose,
    onOpen,
    origin,
    productVersion,
    readSessionToken,
}: {
    onClose: () => void;
    onOpen: () => void;
    origin: string;
    productVersion: string;
    readSessionToken: () => Promise<string | null>;
}) {
    const httpUrl = new URL('/trpc', origin).toString();
    const socketUrl = new URL('/trpc', origin);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    const wsClient = createWSClient({
        connectionParams: async () => {
            const token = await readSessionToken();
            return {
                appProtocolVersion: String(appProtocolVersion),
                ...(token ? { clerkSessionToken: token } : {}),
                productVersion,
            };
        },
        onClose,
        onOpen,
        url: socketUrl.toString(),
    });

    return {
        client: grottoTrpc.createClient({
            links: [
                splitLink({
                    condition: (operation) => operation.type === 'subscription',
                    false: createHttpLink({
                        productVersion,
                        readSessionToken,
                        url: httpUrl,
                    }),
                    true: wsLink({ client: wsClient }),
                }),
            ],
        }),
        wsClient,
    };
}

export function reconnectGrottoRealtimeClient(wsClient: TRPCWebSocketClient) {
    wsClient.connection?.ws?.close();
}

function createHttpLink({
    productVersion,
    readSessionToken,
    url,
}: {
    productVersion: string;
    readSessionToken: () => Promise<string | null>;
    url: string;
}) {
    return httpBatchLink({
        headers: async () => {
            const token = await readSessionToken();
            return {
                [appProtocolHeaders.productVersion]: productVersion,
                [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
                ...(token ? { authorization: `Bearer ${token}` } : {}),
            };
        },
        methodOverride: 'POST',
        url,
    });
}
