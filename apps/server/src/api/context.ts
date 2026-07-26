export interface ApiContext {
    /**
     * Clerk session token forwarded by the app. HTTP requests carry it as an
     * `Authorization: Bearer` header; websocket connections pass it via tRPC
     * connectionParams. Null in keyless dev mode.
     */
    clerkSessionToken: string | null;
    /** Incoming Host header used to restrict local-only development routes. */
    requestHost: string | null;
}

interface ContextCarrier {
    info?: { connectionParams?: Record<string, string | undefined> | null } | null;
    req?: { headers?: Record<string, string | string[] | undefined> } | null;
}

export function createApiContext(opts?: ContextCarrier): ApiContext {
    const hostHeader = opts?.req?.headers?.host;
    const requestHost = Array.isArray(hostHeader) ? (hostHeader[0] ?? null) : (hostHeader ?? null);
    const fromConnection = opts?.info?.connectionParams?.clerkSessionToken;
    const header = opts?.req?.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    const clerkSessionToken =
        typeof fromConnection === 'string' && fromConnection.length > 0
            ? fromConnection
            : typeof value === 'string' && value.startsWith('Bearer ')
              ? value.slice(7)
              : null;

    // The session stays on this request. Only the explicit Runtime seams
    // (`agentRuntime.connect`, `identity.pushSessionToken`) publish a token to
    // the shared Runtime transport this sidecar owns.
    return { clerkSessionToken, requestHost };
}
