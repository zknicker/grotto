import { createHash, randomBytes } from 'node:crypto';
import {
    type ComputerUpdateProgress,
    computerProtocolVersion,
    type HostedComputerInventory,
} from '@tavern/api';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    computerSetupApprovalsTable,
    computersTable,
    serversTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import type { ComputerHandshake } from './contracts.ts';

const approvalLifetimeMs = 10 * 60 * 1000;

export class ComputerSetupDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ComputerSetupDeniedError';
    }
}

export function hashComputerSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

export async function beginComputerSetup(
    db: GrottoDatabase,
    input: { credentialHash: string; slug: string }
) {
    const [server] = await db
        .select({ id: serversTable.id })
        .from(serversTable)
        .where(and(eq(serversTable.slug, input.slug), isNull(serversTable.deletedAt)))
        .limit(1);
    if (!server) {
        throw new ComputerSetupDeniedError('No Grotto server exists at that address.');
    }
    const secret = randomBytes(32).toString('base64url');
    const approvalId = createOpaqueId('cap');
    await db.insert(computerSetupApprovalsTable).values({
        approvalSecretHash: hashComputerSecret(secret),
        credentialHash: input.credentialHash,
        expiresAt: new Date(Date.now() + approvalLifetimeMs),
        id: approvalId,
        serverId: server.id,
    });
    return { approvalId, secret, serverId: server.id };
}

export async function readComputerSetupStatus(
    db: GrottoDatabase,
    input: { approvalId: string; secret: string }
) {
    const [approval] = await db
        .select({
            computerId: computerSetupApprovalsTable.computerId,
            expiresAt: computerSetupApprovalsTable.expiresAt,
            secretHash: computerSetupApprovalsTable.approvalSecretHash,
            serverId: computerSetupApprovalsTable.serverId,
        })
        .from(computerSetupApprovalsTable)
        .where(eq(computerSetupApprovalsTable.id, input.approvalId))
        .limit(1);
    if (!approval || approval.secretHash !== hashComputerSecret(input.secret)) {
        throw new ComputerSetupDeniedError('Computer approval was rejected.');
    }
    if (approval.expiresAt <= new Date()) {
        throw new ComputerSetupDeniedError('Computer approval expired. Run setup again.');
    }
    return approval.computerId
        ? {
              computerId: approval.computerId,
              serverId: approval.serverId,
              status: 'approved' as const,
          }
        : { status: 'pending' as const };
}

export async function approveComputerSetup(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { approvalId: string; secret: string }
) {
    return await db.transaction(async (tx) => {
        const [approval] = await tx
            .select()
            .from(computerSetupApprovalsTable)
            .where(eq(computerSetupApprovalsTable.id, input.approvalId))
            .for('update');
        if (
            !approval ||
            approval.approvalSecretHash !== hashComputerSecret(input.secret) ||
            approval.expiresAt <= new Date() ||
            approval.computerId
        ) {
            throw new ComputerSetupDeniedError('Computer approval expired or was already used.');
        }
        const server = await requireServerMembership(tx, member, approval.serverId);
        if (server.role !== 'owner' && server.role !== 'admin') {
            throw new ComputerSetupDeniedError(
                'Only a Server Owner or Admin can attach a Computer.'
            );
        }
        if (!member) {
            throw new ComputerSetupDeniedError('Sign in to attach a Computer.');
        }
        const computerId = createOpaqueId('cmp');
        await tx.insert(computersTable).values({
            attachedByUserId: member.id,
            credentialHash: approval.credentialHash,
            id: computerId,
            serverId: approval.serverId,
        });
        await tx
            .update(computerSetupApprovalsTable)
            .set({ approvedAt: new Date(), approvedByUserId: member.id, computerId })
            .where(
                and(
                    eq(computerSetupApprovalsTable.id, approval.id),
                    isNull(computerSetupApprovalsTable.computerId)
                )
            );
        return { computerId, serverId: approval.serverId };
    });
}

export async function validateComputerCredential(
    db: GrottoDatabase,
    input: { credentialHash: string; serverId: string }
) {
    const [computer] = await db
        .select({ id: computersTable.id })
        .from(computersTable)
        .where(
            and(
                eq(computersTable.serverId, input.serverId),
                eq(computersTable.credentialHash, input.credentialHash)
            )
        )
        .limit(1);
    if (!computer) {
        throw new ComputerSetupDeniedError(
            'Computer credential was rejected. Open the App to manage this attachment.'
        );
    }
    return computer;
}

export async function reportComputerHandshake(
    db: GrottoDatabase,
    credentialHash: string,
    handshake: ComputerHandshake
) {
    const [computer] = await db
        .select({ id: computersTable.id, serverId: computersTable.serverId })
        .from(computersTable)
        .where(eq(computersTable.credentialHash, credentialHash))
        .limit(1);
    if (!computer) {
        throw new ComputerSetupDeniedError('Computer credential was rejected.');
    }
    const { update, ...facts } = handshake;
    await db
        .update(computersTable)
        .set({
            ...facts,
            health:
                handshake.protocolVersion === computerProtocolVersion
                    ? handshake.health
                    : 'update-required',
            lastConnectedAt: new Date(),
            updateDetail: update.detail,
            updatePhase: update.phase,
            updateTargetVersion: update.targetVersion,
            updateUpdatedAt: new Date(update.updatedAt),
        })
        .where(eq(computersTable.id, computer.id));
    return computer;
}

export async function reportComputerUpdateProgress(
    db: GrottoDatabase,
    computerId: string,
    update: ComputerUpdateProgress
) {
    await db
        .update(computersTable)
        .set({
            updateDetail: update.detail,
            updatePhase: update.phase,
            updateTargetVersion: update.targetVersion,
            updateUpdatedAt: new Date(update.updatedAt),
        })
        .where(eq(computersTable.id, computerId));
}

/** Replaces a Computer's last-reported runtime/model inventory wholesale. */
export async function recordComputerInventory(
    db: GrottoDatabase,
    computerId: string,
    inventory: HostedComputerInventory
) {
    await db
        .update(computersTable)
        .set({ reportedInventory: inventory })
        .where(eq(computersTable.id, computerId));
}

export async function markComputerOffline(db: GrottoDatabase, computerId: string) {
    await db
        .update(computersTable)
        .set({ health: 'offline' })
        .where(eq(computersTable.id, computerId));
}

export async function listServerComputers(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
) {
    const server = await requireServerMembership(db, member, serverId);
    if (server.role !== 'owner' && server.role !== 'admin') {
        throw new ComputerSetupDeniedError('Only a Server Owner or Admin can view Computers.');
    }
    return await db
        .select({
            architecture: computersTable.architecture,
            createdAt: computersTable.createdAt,
            health: computersTable.health,
            id: computersTable.id,
            lastConnectedAt: computersTable.lastConnectedAt,
            operatingSystem: computersTable.operatingSystem,
            productVersion: computersTable.productVersion,
            protocolVersion: computersTable.protocolVersion,
            reportedInventory: computersTable.reportedInventory,
            updateDetail: computersTable.updateDetail,
            updatePhase: computersTable.updatePhase,
            updateTargetVersion: computersTable.updateTargetVersion,
            updateUpdatedAt: computersTable.updateUpdatedAt,
        })
        .from(computersTable)
        .where(eq(computersTable.serverId, serverId))
        .orderBy(desc(computersTable.createdAt));
}

/** A Computer credential is deleted only after every assigned Agent is retired. */
export async function removeServerComputer(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { computerId: string; confirmation: string; serverId: string }
) {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const server = await requireServerMembership(tx, member, input.serverId);
        if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
            throw new ComputerSetupDeniedError(
                'Only a Server Owner or Admin can remove a Computer.'
            );
        }
        if (input.confirmation !== 'REMOVE') {
            throw new ComputerSetupDeniedError('Type REMOVE to remove this Computer.');
        }
        const [computer] = await tx
            .select({ id: computersTable.id })
            .from(computersTable)
            .where(
                and(
                    eq(computersTable.id, input.computerId),
                    eq(computersTable.serverId, input.serverId)
                )
            )
            .limit(1);
        if (!computer) {
            throw new ComputerSetupDeniedError('That Computer no longer exists.');
        }
        const [assigned] = await tx
            .select({ id: agentsTable.id })
            .from(agentsTable)
            .where(
                and(
                    eq(agentsTable.serverId, input.serverId),
                    eq(agentsTable.computerId, computer.id)
                )
            )
            .limit(1);
        if (assigned) {
            throw new ComputerSetupDeniedError(
                'Delete every assigned Agent before removing this Computer.'
            );
        }
        await tx.delete(computersTable).where(eq(computersTable.id, computer.id));
        return { computerId: computer.id };
    });
}
