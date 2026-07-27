import { randomBytes } from 'node:crypto';
import type { HostedRunnerMintRequest, HostedRunnerRevokeRequest } from '@tavern/api';
import { and, eq, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentRunnerCredentialsTable,
    agentsTable,
    chatsTable,
    computersTable,
} from '../postgres/schema.ts';
import { ComputerSetupDeniedError, hashComputerSecret } from './service.ts';

export interface ResolvedRunner {
    agentId: string;
    chatId: string;
    computerId: string;
    runnerId: string;
    serverId: string;
}

/**
 * Mints one scoped runner credential for an Agent launch. The caller proves the
 * Computer credential; the credential is bound to a single Agent, run, and
 * collaboration chat, and every reference is checked to belong to that
 * Computer's Server so a Computer can never mint authority for another tenant.
 */
export async function mintRunnerCredential(db: GrottoDatabase, input: HostedRunnerMintRequest) {
    const computer = await requireComputer(db, input.credentialHash);

    const [agent] = await db
        .select({ computerId: agentsTable.computerId })
        .from(agentsTable)
        .where(and(eq(agentsTable.serverId, computer.serverId), eq(agentsTable.id, input.agentId)))
        .limit(1);
    if (!agent || agent.computerId !== computer.id) {
        throw new ComputerSetupDeniedError('That Agent is not assigned to this Computer.');
    }

    const [chat] = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, computer.serverId), eq(chatsTable.id, input.chatId)))
        .limit(1);
    if (!chat) {
        throw new ComputerSetupDeniedError('That collaboration chat does not exist.');
    }

    const runnerToken = `grtr_${randomBytes(32).toString('base64url')}`;
    const runnerId = createOpaqueId('arc');
    await db.insert(agentRunnerCredentialsTable).values({
        agentId: input.agentId,
        chatId: input.chatId,
        computerId: computer.id,
        id: runnerId,
        runId: input.runId,
        serverId: computer.serverId,
        tokenHash: hashComputerSecret(runnerToken),
    });
    return { runnerId, runnerToken };
}

/** Revokes a runner credential at launch end. Idempotent for an already-gone row. */
export async function revokeRunnerCredential(db: GrottoDatabase, input: HostedRunnerRevokeRequest) {
    const computer = await requireComputer(db, input.credentialHash);
    await db
        .update(agentRunnerCredentialsTable)
        .set({ revokedAt: new Date() })
        .where(
            and(
                eq(agentRunnerCredentialsTable.id, input.runnerId),
                eq(agentRunnerCredentialsTable.computerId, computer.id),
                isNull(agentRunnerCredentialsTable.revokedAt)
            )
        );
    return { revoked: true };
}

/**
 * Revokes every live runner credential for one run. A human Stop calls this
 * durably, so the credential dies even when the Computer is offline: a Computer
 * that never got the Stop frame — or that restarts and re-runs the killed turn —
 * can no longer speak as the Agent, and the Stop stays effective.
 */
export async function revokeRunnerCredentialsForRun(
    db: GrottoDatabase,
    input: { agentId: string; runId: string; serverId: string }
): Promise<void> {
    await db
        .update(agentRunnerCredentialsTable)
        .set({ revokedAt: new Date() })
        .where(
            and(
                eq(agentRunnerCredentialsTable.serverId, input.serverId),
                eq(agentRunnerCredentialsTable.agentId, input.agentId),
                eq(agentRunnerCredentialsTable.runId, input.runId),
                isNull(agentRunnerCredentialsTable.revokedAt)
            )
        );
}

/** Resolves a runner token to its bound Agent, chat, and Server. Fails closed. */
export async function resolveRunnerCredential(
    db: GrottoDatabase,
    token: string
): Promise<ResolvedRunner | null> {
    const [row] = await db
        .select({
            agentId: agentRunnerCredentialsTable.agentId,
            chatId: agentRunnerCredentialsTable.chatId,
            computerId: agentRunnerCredentialsTable.computerId,
            runnerId: agentRunnerCredentialsTable.id,
            serverId: agentRunnerCredentialsTable.serverId,
        })
        .from(agentRunnerCredentialsTable)
        .where(
            and(
                eq(agentRunnerCredentialsTable.tokenHash, hashComputerSecret(token)),
                isNull(agentRunnerCredentialsTable.revokedAt)
            )
        )
        .limit(1);
    return row ?? null;
}

async function requireComputer(db: GrottoDatabase, credentialHash: string) {
    const [computer] = await db
        .select({ id: computersTable.id, serverId: computersTable.serverId })
        .from(computersTable)
        .where(eq(computersTable.credentialHash, credentialHash))
        .limit(1);
    if (!computer) {
        throw new ComputerSetupDeniedError('Computer credential was rejected.');
    }
    return computer;
}
