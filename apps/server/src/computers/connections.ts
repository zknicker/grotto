import type { HostedAgentStartCommand } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentsTable, chatsTable } from '../postgres/schema.ts';

interface AttachedComputer {
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

export type StartAgentTurnResult =
    | { runId: string; started: true }
    | { reason: 'busy' | 'offline' | 'unconfigured'; started: false };

/**
 * The live registry of Computer attachment sockets. It is the Server→Computer
 * side of the typed protocol: the socket layer registers each accepted
 * attachment, and `startAgentTurn` sends the launch command down to the Agent's
 * assigned Computer. One in-flight run per Agent is enforced here so a second
 * wake never double-launches an Agent's single session.
 */
export class ComputerConnections {
    private readonly attached = new Map<string, AttachedComputer>();
    private readonly activeRuns = new Map<string, string>();
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

    sendMcpConnection(computerId: string, connection: unknown): boolean {
        const attached = this.attached.get(computerId);
        if (!attached) {
            return false;
        }
        attached.send({ connection, type: 'mcp-upsert' });
        return true;
    }

    sendMcpGrant(computerId: string, grant: unknown): boolean {
        const attached = this.attached.get(computerId);
        if (!attached) {
            return false;
        }
        attached.send({ grant, type: 'mcp-grant' });
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

    finishRun(agentId: string): void {
        this.activeRuns.delete(agentId);
    }

    /**
     * Resolves the Agent's assigned Computer and desired runtime/model and sends
     * a typed `start` down its socket. Fails closed when the Agent is
     * unconfigured, its Computer is offline, or it already has a running turn.
     */
    async startAgentTurn(
        db: GrottoDatabase,
        input: { agentId: string; chatId: string; prompt: string }
    ): Promise<StartAgentTurnResult> {
        const [agent] = await db
            .select({
                computerId: agentsTable.computerId,
                desiredModelId: agentsTable.desiredModelId,
                desiredRuntimeId: agentsTable.desiredRuntimeId,
            })
            .from(agentsTable)
            .where(eq(agentsTable.id, input.agentId))
            .limit(1);
        if (!(agent?.computerId && agent.desiredRuntimeId && agent.desiredModelId)) {
            return { reason: 'unconfigured', started: false };
        }
        if (!this.attached.has(agent.computerId)) {
            return { reason: 'offline', started: false };
        }
        if (this.activeRuns.has(input.agentId)) {
            return { reason: 'busy', started: false };
        }

        const runId = createOpaqueId('run');
        const command: HostedAgentStartCommand = {
            agentId: input.agentId,
            chatId: input.chatId,
            modelId: agent.desiredModelId,
            prompt: input.prompt,
            runId,
            runtimeId: agent.desiredRuntimeId,
            type: 'start',
        };
        this.activeRuns.set(input.agentId, runId);
        this.attached.get(agent.computerId)?.send(command);
        return { runId, started: true };
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

/** Resolves the Agent seated in a DM chat, if any. */
export async function readDmAgentId(
    db: GrottoDatabase,
    serverId: string,
    chatId: string
): Promise<string | null> {
    const [chat] = await db
        .select({ dmAgentId: chatsTable.dmAgentId, kind: chatsTable.kind })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, serverId), eq(chatsTable.id, chatId)))
        .limit(1);
    return chat?.kind === 'dm' ? (chat.dmAgentId ?? null) : null;
}
