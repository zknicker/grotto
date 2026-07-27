import type { HostedAgentStartCommand } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentsTable, chatsTable } from '../postgres/schema.ts';

interface AttachedComputer {
    send(frame: unknown): void;
    serverId: string;
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

    register(computerId: string, computer: AttachedComputer): void {
        this.attached.set(computerId, computer);
    }

    unregister(computerId: string): void {
        this.attached.delete(computerId);
    }

    isOnline(computerId: string): boolean {
        return this.attached.has(computerId);
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
