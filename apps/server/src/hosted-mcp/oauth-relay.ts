import { randomBytes } from 'node:crypto';
import type { HostedMcpOAuthStartResult } from '@tavern/api';
import { eq } from 'drizzle-orm';
import { emitServerUpdated } from '../grotto-api/server-events.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { mcpConnectionsTable } from '../postgres/schema.ts';
import { completeHostedMcpAuthorization, startHostedMcpAuthorization } from './oauth.ts';
import type { HostedMcpRuntime } from './runtime.ts';

interface OAuthAttempt {
    connectionId: string;
    expiresAt: number;
    redirectUrl: string;
}

export type HostedMcpOAuthCallbackResult =
    | { status: 'complete' }
    | { status: 'expired' }
    | { status: 'failed' };

/** Server-local OAuth state. Callback codes and credentials never leave Server custody. */
export class HostedMcpOAuthRelay {
    private readonly attempts = new Map<string, OAuthAttempt>();

    constructor(
        private readonly db: GrottoDatabase,
        private readonly runtime: HostedMcpRuntime,
        private readonly now: () => number = Date.now,
        private readonly ttlMs = 5 * 60_000
    ) {}

    async start(input: {
        allowAuthorizationServerOrigin: boolean;
        connectionId: string;
        redirectUrl: string;
    }): Promise<HostedMcpOAuthStartResult> {
        validateRedirectUrl(input.redirectUrl);
        this.removeExpired();
        const routingState = randomBytes(32).toString('base64url');
        this.attempts.set(routingState, {
            connectionId: input.connectionId,
            expiresAt: this.now() + this.ttlMs,
            redirectUrl: input.redirectUrl,
        });
        try {
            const result = await startHostedMcpAuthorization(this.runtime, {
                ...input,
                routingState,
            });
            if (result.status !== 'ready') {
                this.attempts.delete(routingState);
            }
            return result;
        } catch (cause) {
            this.attempts.delete(routingState);
            throw cause;
        }
    }

    async complete(state: string, code: string): Promise<HostedMcpOAuthCallbackResult> {
        const attempt = this.attempts.get(state);
        this.attempts.delete(state);
        if (!attempt || attempt.expiresAt <= this.now()) {
            return { status: 'expired' };
        }
        try {
            await completeHostedMcpAuthorization(this.runtime, {
                code,
                connectionId: attempt.connectionId,
                redirectUrl: attempt.redirectUrl,
                state,
            });
            await this.runtime.closeConnection(attempt.connectionId);
            const discovery = await this.runtime.discover(attempt.connectionId);
            const [updated] = await this.db
                .update(mcpConnectionsTable)
                .set({
                    accountLabel: discovery.accountLabel,
                    connected: true,
                    tools: [...new Set(discovery.tools)].sort(),
                })
                .where(eq(mcpConnectionsTable.id, attempt.connectionId))
                .returning({ serverId: mcpConnectionsTable.serverId });
            if (updated) {
                emitServerUpdated({ scope: 'mcp', serverId: updated.serverId });
            }
            return { status: 'complete' };
        } catch {
            return { status: 'failed' };
        }
    }

    private removeExpired(): void {
        const now = this.now();
        for (const [state, attempt] of this.attempts) {
            if (attempt.expiresAt <= now) {
                this.attempts.delete(state);
            }
        }
    }
}

function validateRedirectUrl(value: string): void {
    const url = new URL(value);
    const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
    if (
        url.pathname !== '/mcp/oauth/callback' ||
        url.search ||
        url.hash ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    ) {
        throw new Error('The MCP OAuth callback URL is invalid.');
    }
}
