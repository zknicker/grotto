import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCClientError, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import * as React from 'react';
import type { GrottoRouter } from '../../../../server/src/grotto-api/router.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { resolveActivationFixture } from './activation-preview-fixtures.ts';

/**
 * A Grotto client whose only link answers from activation fixtures. The real
 * activation components run their real hooks against it, so the preview never
 * needs a hosted Server, a Computer, or a signed-in session.
 */
export function ActivationPreviewServer({ children }: React.PropsWithChildren) {
    const [queryClient] = React.useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    mutations: { retry: false },
                    queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
                },
            })
    );
    const [client] = React.useState(() =>
        grottoTrpc.createClient({ links: [activationFixtureLink] })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <grottoTrpc.Provider client={client} queryClient={queryClient}>
                {children}
            </grottoTrpc.Provider>
        </QueryClientProvider>
    );
}

const activationFixtureLink: TRPCLink<GrottoRouter> =
    () =>
    ({ op }) =>
        observable((observer) => {
            let cancelled = false;

            resolveActivationFixture(op.path, op.input)
                .then((data) => {
                    if (cancelled) {
                        return;
                    }
                    observer.next({ result: { data, type: 'data' } });
                    observer.complete();
                })
                .catch((error: unknown) => {
                    if (!cancelled) {
                        observer.error(TRPCClientError.from(toError(error)));
                    }
                });

            return () => {
                cancelled = true;
            };
        });

function toError(cause: unknown): Error {
    return cause instanceof Error ? cause : new Error(String(cause));
}
