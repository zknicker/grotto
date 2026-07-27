import type { HostedAgentCommand } from '@tavern/api';
import type { DeliveryTransport } from '../agent-delivery/delivery.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';

interface AttachedComputer {
    disconnect?(): void;
    send(frame: unknown): void;
    serverId: string;
}

type McpOAuthStartResult =
    | { authorizationUrl: string; status: 'ready' }
    | { authorizationServerOrigin: string; status: 'trust-required' };

interface PendingMcpRequest {
    computerId: string;
    reject(error: Error): void;
    resolve(value: unknown): void;
    timeout: ReturnType<typeof setTimeout>;
    type: 'mcp-oauth-completed' | 'mcp-oauth-started';
}

/**
 * The live registry of Computer attachment sockets — the Server→Computer side of
 * the typed protocol. It is pure transport: durable run, stop, and pending state
 * live in PostgreSQL and are owned by {@link AgentDelivery}. The socket layer
 * registers each accepted attachment; delivery resolves the target Computer and
 * hands a typed frame here to send.
 */
export class ComputerConnections implements DeliveryTransport {
    private readonly attached = new Map<string, AttachedComputer>();
    private readonly pendingMcpRequests = new Map<string, PendingMcpRequest>();

    register(computerId: string, computer: AttachedComputer): void {
        this.attached.set(computerId, computer);
    }

    unregister(computerId: string): void {
        this.attached.delete(computerId);
        for (const [requestId, pending] of this.pendingMcpRequests) {
            if (pending.computerId === computerId) {
                clearTimeout(pending.timeout);
                this.pendingMcpRequests.delete(requestId);
                pending.reject(new Error('The selected Computer went offline.'));
            }
        }
    }

    isOnline(computerId: string): boolean {
        return this.attached.has(computerId);
    }

    /** Sends cleanup to every online Computer for a Server, then disconnects it without waiting. */
    cleanupServer(serverId: string): number {
        let sent = 0;
        for (const [computerId, computer] of this.attached) {
            if (computer.serverId !== serverId) {
                continue;
            }
            this.unregister(computerId);
            try {
                computer.send({ type: 'server-delete' });
                sent += 1;
            } catch {
                // Closing sockets and offline Computers never delay Server deletion.
            }
            try {
                computer.disconnect?.();
            } catch {
                // The credential is already revoked; disconnect is best-effort.
            }
        }
        return sent;
    }

    /** Sends a typed frame to the Computer, reporting whether it was online. */
    send(computerId: string, frame: HostedAgentCommand): boolean {
        const computer = this.attached.get(computerId);
        if (!computer) {
            return false;
        }
        computer.send(frame);
        return true;
    }

    sendMcpConnection(computerId: string, connection: unknown): boolean {
        const computer = this.attached.get(computerId);
        if (!computer) {
            return false;
        }
        computer.send({ connection, type: 'mcp-upsert' });
        return true;
    }

    sendMcpGrant(computerId: string, grant: unknown): boolean {
        const computer = this.attached.get(computerId);
        if (!computer) {
            return false;
        }
        computer.send({ grant, type: 'mcp-grant' });
        return true;
    }
    sendMcpHeaders(
        computerId: string,
        connectionId: string,
        headers: Record<string, string>
    ): boolean {
        const attached = this.attached.get(computerId);
        if (!attached) {
            return false;
        }
        attached.send({ connectionId, headers, type: 'mcp-replace-headers' });
        return true;
    }

    sendMcpControl(
        computerId: string,
        type: 'mcp-delete' | 'mcp-disconnect' | 'mcp-refresh',
        connectionId: string
    ): boolean {
        const attached = this.attached.get(computerId);
        if (!attached) {
            return false;
        }
        attached.send({ connectionId, type });
        return true;
    }

    requestMcpOAuthStart(
        computerId: string,
        input: {
            allowAuthorizationServerOrigin: boolean;
            connectionId: string;
            redirectUrl: string;
            routingState: string;
        }
    ): Promise<McpOAuthStartResult> {
        return this.requestMcp(computerId, 'mcp-oauth-started', {
            ...input,
            type: 'mcp-oauth-start',
        });
    }

    requestMcpOAuthComplete(
        computerId: string,
        input: { code: string; connectionId: string; redirectUrl: string; state: string }
    ): Promise<void> {
        return this.requestMcp(computerId, 'mcp-oauth-completed', {
            ...input,
            type: 'mcp-oauth-complete',
        });
    }

    acceptMcpResponse(
        computerId: string,
        input: { error?: string; requestId: string; result?: unknown; type: string }
    ): boolean {
        const pending = this.pendingMcpRequests.get(input.requestId);
        if (!pending || pending.computerId !== computerId || pending.type !== input.type) {
            return false;
        }
        clearTimeout(pending.timeout);
        this.pendingMcpRequests.delete(input.requestId);
        if (input.error) {
            pending.reject(new Error(input.error));
        } else {
            pending.resolve(input.result);
        }
        return true;
    }

    private requestMcp<Result>(
        computerId: string,
        responseType: PendingMcpRequest['type'],
        frame: Record<string, unknown>
    ): Promise<Result> {
        const attached = this.attached.get(computerId);
        if (!attached) {
            return Promise.reject(new Error('The selected Computer must be online.'));
        }
        const requestId = createOpaqueId('req');
        return new Promise<Result>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingMcpRequests.delete(requestId);
                reject(new Error('The selected Computer did not respond.'));
            }, 10_000);
            this.pendingMcpRequests.set(requestId, {
                computerId,
                reject,
                resolve: (value) => resolve(value as Result),
                timeout,
                type: responseType,
            });
            attached.send({ ...frame, requestId });
        });
    }
}
