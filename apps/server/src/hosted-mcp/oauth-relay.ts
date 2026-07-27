import { randomBytes } from 'node:crypto';
import type { HostedMcpOAuthStartResult } from '@tavern/api';
import type { ComputerConnections } from '../computers/connections.ts';

interface OAuthAttempt {
    computerId: string;
    connectionId: string;
    expiresAt: number;
    redirectUrl: string;
}

export type HostedMcpOAuthCallbackResult =
    | { status: 'complete' }
    | { status: 'expired' }
    | { status: 'failed' }
    | { status: 'offline' };

/** One live OAuth handoff. Routing state and callback codes never reach durable storage. */
export class HostedMcpOAuthRelay {
    private readonly attempts = new Map<string, OAuthAttempt>();

    constructor(
        private readonly connections: ComputerConnections,
        private readonly now: () => number = Date.now,
        private readonly ttlMs = 5 * 60_000
    ) {}

    async start(input: {
        allowAuthorizationServerOrigin: boolean;
        computerId: string;
        connectionId: string;
        redirectUrl: string;
    }): Promise<HostedMcpOAuthStartResult> {
        validateRedirectUrl(input.redirectUrl);
        this.removeExpired();
        const routingState = randomBytes(32).toString('base64url');
        this.attempts.set(routingState, {
            computerId: input.computerId,
            connectionId: input.connectionId,
            expiresAt: this.now() + this.ttlMs,
            redirectUrl: input.redirectUrl,
        });
        try {
            const result = await this.connections.requestMcpOAuthStart(input.computerId, {
                allowAuthorizationServerOrigin: input.allowAuthorizationServerOrigin,
                connectionId: input.connectionId,
                redirectUrl: input.redirectUrl,
                routingState,
            });
            if (result.status !== 'ready') {
                this.attempts.delete(routingState);
            }
            return result;
        } catch (error) {
            this.attempts.delete(routingState);
            throw error;
        }
    }

    async complete(state: string, code: string): Promise<HostedMcpOAuthCallbackResult> {
        const attempt = this.attempts.get(state);
        this.attempts.delete(state);
        if (!attempt || attempt.expiresAt <= this.now()) {
            return { status: 'expired' };
        }
        if (!this.connections.isOnline(attempt.computerId)) {
            return { status: 'offline' };
        }
        try {
            await this.connections.requestMcpOAuthComplete(attempt.computerId, {
                code,
                connectionId: attempt.connectionId,
                redirectUrl: attempt.redirectUrl,
                state,
            });
            return { status: 'complete' };
        } catch (error) {
            return {
                status:
                    error instanceof Error && error.message.includes('offline')
                        ? 'offline'
                        : 'failed',
            };
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
