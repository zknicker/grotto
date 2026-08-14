/// <reference path="./assets.d.ts" />

import { appProtocolHeaders, appProtocolVersion } from '@tavern/api/app-protocol';
import type { GrottoRouter } from '@tavern/server/grotto-router';
import { httpBatchLink } from '@trpc/client';
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
            httpBatchLink({
                headers: async () => {
                    const token = await readSessionToken();
                    return {
                        [appProtocolHeaders.productVersion]: productVersion,
                        [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
                        ...(token ? { authorization: `Bearer ${token}` } : {}),
                    };
                },
                methodOverride: 'POST',
                url: new URL('/trpc', origin).toString(),
            }),
        ],
    });
}
