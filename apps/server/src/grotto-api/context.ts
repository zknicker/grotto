import type { ClerkSessions } from '../identity/clerk-sessions.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';

/**
 * Request context for the hosted Grotto Server. It carries the Clerk session
 * for this request only — never process-shared identity — plus the Server's
 * PostgreSQL database.
 */
export interface GrottoContext {
    clerkSessions: ClerkSessions;
    /**
     * Clerk session token presented by the App. HTTP requests carry it as an
     * `Authorization: Bearer` header; WebSocket connections pass it via tRPC
     * connectionParams. Null when the request is unauthenticated.
     */
    clerkSessionToken: string | null;
    grottoDb: GrottoDatabase;
}

export interface GrottoContextDependencies {
    clerkSessions: ClerkSessions;
    grottoDb: GrottoDatabase;
}

interface ContextCarrier {
    info?: { connectionParams?: Record<string, string | undefined> | null } | null;
    req?: { headers?: Record<string, string | string[] | undefined> } | null;
}

export function createGrottoContextFactory(dependencies: GrottoContextDependencies) {
    return (opts?: ContextCarrier): GrottoContext => ({
        ...dependencies,
        clerkSessionToken: readClerkSessionToken(opts),
    });
}

function readClerkSessionToken(opts?: ContextCarrier) {
    const fromConnection = opts?.info?.connectionParams?.clerkSessionToken;

    if (typeof fromConnection === 'string' && fromConnection.length > 0) {
        return fromConnection;
    }

    const header = opts?.req?.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;

    return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : null;
}
