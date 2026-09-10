import type { FapiRequestInit, FapiResponse } from '@clerk/clerk-js/dist/types/core/fapiClient';
import { Clerk } from '@clerk/clerk-js/headless';
import { getDesktopBridge } from './desktop-bridge.ts';

let nativeClerk: Clerk | null = null;

export function getNativeClerk(publishableKey: string): Clerk {
    if (nativeClerk?.publishableKey === publishableKey) {
        return nativeClerk;
    }

    if (nativeClerk) {
        void getRequiredDesktopBridge().authTokenSet(null);
    }

    const clerk = new Clerk(publishableKey);

    clerk.__unstable__onBeforeRequest(async (requestInit: FapiRequestInit) => {
        requestInit.credentials = 'omit';
        requestInit.url?.searchParams.append('_is_native', '1');

        const jwt = await getRequiredDesktopBridge().authTokenGet();
        (requestInit.headers as Headers).set('authorization', jwt || '');
    });

    // This is an internal Clerk API used by Clerk's native SDKs.
    clerk.__unstable__onAfterResponse(
        async (_requestInit: FapiRequestInit, response?: FapiResponse<unknown>) => {
            const authHeader = response?.headers.get('authorization');
            if (authHeader) {
                await getRequiredDesktopBridge().authTokenSet(authHeader);
            }
        }
    );

    nativeClerk = clerk;
    return clerk;
}

export async function getNativeClerkSessionToken(): Promise<string | null> {
    return (await nativeClerk?.session?.getToken()) ?? null;
}

function getRequiredDesktopBridge() {
    const bridge = getDesktopBridge();
    if (!bridge) {
        throw new Error('Native Clerk requires the Haus desktop bridge.');
    }
    return bridge;
}
