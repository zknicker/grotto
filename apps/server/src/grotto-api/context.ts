import { appProtocolHeaders } from '@grotto/api';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import type { AttachmentRoot } from '../attachments/attachment-root.ts';
import type { ComputerConnections } from '../computers/connections.ts';
import type { ClerkSessions } from '../identity/clerk-sessions.ts';
import type { ClerkUsers } from '../identity/clerk-users.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import type { McpOAuthRelay } from '../server-mcp/oauth-relay.ts';
import type { McpRuntime } from '../server-mcp/runtime.ts';

/**
 * Request context for the Grotto Server. It carries the Clerk session
 * for this request only — never process-shared identity — plus the Server's
 * PostgreSQL database.
 */
export interface GrottoContext {
    /** Server-owned durable Agent delivery: pending inbox, runs, and Stop state. */
    agentDelivery: AgentDelivery;
    appOrigin: string;
    /** App provenance and exact wire-contract declaration for this request. */
    appProtocol: { productVersion: string | null; protocolVersion: number | null };
    attachmentRoot: AttachmentRoot;
    clerkSessions: ClerkSessions;
    /**
     * Clerk session token presented by the App. HTTP requests carry it as an
     * `Authorization: Bearer` header; WebSocket connections pass it via tRPC
     * connectionParams. Null when the request is unauthenticated.
     */
    clerkSessionToken: string | null;
    /** Verified-email lookup, used only by the invitation boundary. */
    clerkUsers: ClerkUsers;
    /** Live attachment sockets for MCP configuration delivery. */
    computerConnections: ComputerConnections;
    computerReleaseManifestUrl: string;
    grottoDb: GrottoDatabase;
    mcpOAuthRelay: McpOAuthRelay;
    mcpRuntime: McpRuntime;
    /** HTTP Host header, used only to constrain localhost development procedures. */
    requestHost: string | null;
}

export interface GrottoContextDependencies {
    agentDelivery: AgentDelivery;
    appOrigin: string;
    attachmentRoot: AttachmentRoot;
    clerkSessions: ClerkSessions;
    clerkUsers: ClerkUsers;
    computerConnections: ComputerConnections;
    computerReleaseManifestUrl: string;
    grottoDb: GrottoDatabase;
    mcpOAuthRelay: McpOAuthRelay;
    mcpRuntime: McpRuntime;
}

interface ContextCarrier {
    info?: { connectionParams?: Record<string, string | undefined> | null } | null;
    req?: { headers?: Record<string, string | string[] | undefined> } | null;
}

export function createGrottoContextFactory(dependencies: GrottoContextDependencies) {
    return (opts?: ContextCarrier): GrottoContext => ({
        ...dependencies,
        appProtocol: readAppProtocol(opts),
        clerkSessionToken: readClerkSessionToken(opts),
        requestHost: readRequestHost(opts),
    });
}

function readAppProtocol(opts?: ContextCarrier) {
    const connection = opts?.info?.connectionParams;
    const headers = opts?.req?.headers;
    const productVersion =
        connection?.productVersion ?? readHeader(headers, appProtocolHeaders.productVersion);
    const rawProtocolVersion =
        connection?.appProtocolVersion ?? readHeader(headers, appProtocolHeaders.protocolVersion);
    const protocolVersion =
        typeof rawProtocolVersion === 'string' && /^\d+$/u.test(rawProtocolVersion)
            ? Number(rawProtocolVersion)
            : null;

    return {
        productVersion:
            typeof productVersion === 'string' && productVersion ? productVersion : null,
        protocolVersion,
    };
}

function readHeader(
    headers: Record<string, string | string[] | undefined> | undefined,
    name: string
) {
    const value = headers?.[name];
    return Array.isArray(value) ? value[0] : value;
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

function readRequestHost(opts?: ContextCarrier) {
    return readHeader(opts?.req?.headers, 'host') ?? null;
}
