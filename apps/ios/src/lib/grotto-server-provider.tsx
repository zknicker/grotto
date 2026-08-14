import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createGrottoHttpClient, grottoTrpc, queryClientDefaultOptions } from '@tavern/app-client';
import { type ReactNode, useRef, useState } from 'react';
import { appConfig } from './app-config';

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
    const [trpcClient] = useState(() =>
        createGrottoHttpClient({
            origin: appConfig.serverOrigin,
            productVersion: appConfig.productVersion,
            readSessionToken: () => readTokenRef.current(),
        })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <grottoTrpc.Provider client={trpcClient} queryClient={queryClient}>
                {children}
            </grottoTrpc.Provider>
        </QueryClientProvider>
    );
}
