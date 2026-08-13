import { createHash } from 'node:crypto';
import {
    type ComputerInventory,
    type ComputerUpdateProgress,
    computerProtocolVersion,
} from '@tavern/api';
import { and, desc, eq, isNotNull, isNull, ne, or } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable, computersTable, serverOnboardingTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import type { ComputerHandshake } from './contracts.ts';

export class ComputerSetupDeniedError extends Error {
    readonly code?: 'computer_machine_unlinked';

    constructor(message: string, code?: 'computer_machine_unlinked') {
        super(message);
        this.code = code;
        this.name = 'ComputerSetupDeniedError';
    }
}

export function hashComputerSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
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
            'Computer credential was rejected. Open the App to manage this attachment.',
            'computer_machine_unlinked'
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
    const compatible = handshake.protocolVersion === computerProtocolVersion;
    await db.transaction(async (tx) => {
        await tx
            .update(computersTable)
            .set({
                ...facts,
                health: compatible ? handshake.health : 'update-required',
                lastConnectedAt: new Date(),
                updateDetail: update.detail,
                updateDownloadedBytes: update.downloadedBytes,
                updateFailedPhase: update.failedPhase,
                updatePhase: update.phase,
                updateActiveAgentCount: update.activeAgentCount,
                updateTargetVersion: update.targetVersion,
                updateTotalBytes: update.totalBytes,
                updateUpdatedAt: new Date(update.updatedAt),
            })
            .where(eq(computersTable.id, computer.id));
        await tx
            .update(serverOnboardingTable)
            .set({
                computerId: computer.id,
                failureCode: compatible ? null : 'computer-incompatible',
                failureDetail: compatible
                    ? null
                    : 'Update Grotto Computer before continuing setup.',
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(serverOnboardingTable.serverId, computer.serverId),
                    ne(serverOnboardingTable.phase, 'complete'),
                    compatible
                        ? or(
                              isNull(serverOnboardingTable.failureCode),
                              ne(serverOnboardingTable.failureCode, 'application-failed')
                          )
                        : undefined,
                    or(
                        eq(serverOnboardingTable.phase, 'awaiting-computer'),
                        eq(serverOnboardingTable.computerId, computer.id)
                    )
                )
            );
    });
    return computer;
}

export async function reportComputerUpdateProgress(
    db: GrottoDatabase,
    computerId: string,
    update: ComputerUpdateProgress
) {
    // Idle is the bootstrap baseline, not a live transition. Older Computers
    // without a progress file report a freshly timestamped idle snapshot on
    // every poll; accepting it would erase Server-owned check/request state.
    if (update.phase === 'idle') {
        return false;
    }
    await db
        .update(computersTable)
        .set({
            updateDetail: update.detail,
            updateDownloadedBytes: update.downloadedBytes,
            updateFailedPhase: update.failedPhase,
            updatePhase: update.phase,
            updateActiveAgentCount: update.activeAgentCount,
            updateTargetVersion: update.targetVersion,
            updateTotalBytes: update.totalBytes,
            updateUpdatedAt: new Date(update.updatedAt),
        })
        .where(eq(computersTable.id, computerId));
    return true;
}

/** Replaces a Computer's last-reported runtime/model inventory wholesale. */
export async function recordComputerInventory(
    db: GrottoDatabase,
    computerId: string,
    inventory: ComputerInventory
) {
    await db.transaction(async (tx) => {
        const [computer] = await tx
            .select({ serverId: computersTable.serverId })
            .from(computersTable)
            .where(eq(computersTable.id, computerId))
            .limit(1);
        if (!computer) {
            return;
        }
        await tx
            .update(computersTable)
            .set({ reportedInventory: inventory })
            .where(eq(computersTable.id, computerId));
        const usable = inventory.runtimes.some((runtime) => runtime.models.length > 0);
        const [onboarding] = await tx
            .select({
                failureCode: serverOnboardingTable.failureCode,
                phase: serverOnboardingTable.phase,
            })
            .from(serverOnboardingTable)
            .where(eq(serverOnboardingTable.serverId, computer.serverId))
            .limit(1);
        await tx
            .update(serverOnboardingTable)
            .set({
                computerId,
                failureCode:
                    usable && onboarding?.failureCode === 'application-failed'
                        ? 'application-failed'
                        : usable
                          ? null
                          : 'inventory-empty',
                failureDetail:
                    usable && onboarding?.failureCode === 'application-failed'
                        ? undefined
                        : usable
                          ? null
                          : 'This Computer did not report a usable runtime and model.',
                ...(usable && onboarding?.phase === 'awaiting-computer'
                    ? { phase: 'awaiting-cove' as const }
                    : {}),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(serverOnboardingTable.serverId, computer.serverId),
                    ne(serverOnboardingTable.phase, 'complete'),
                    or(
                        eq(serverOnboardingTable.phase, 'awaiting-computer'),
                        eq(serverOnboardingTable.computerId, computerId)
                    )
                )
            );
    });
}

export async function markComputerOffline(db: GrottoDatabase, computerId: string) {
    await db.transaction(async (tx) => {
        const [computer] = await tx
            .select({ serverId: computersTable.serverId })
            .from(computersTable)
            .where(eq(computersTable.id, computerId))
            .limit(1);
        if (!computer) {
            return;
        }
        await tx
            .update(computersTable)
            .set({ health: 'offline' })
            .where(eq(computersTable.id, computerId));
        await tx
            .update(serverOnboardingTable)
            .set({
                failureCode: 'computer-disconnected',
                failureDetail: 'The Computer disconnected. Run setup again on that Computer.',
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(serverOnboardingTable.serverId, computer.serverId),
                    eq(serverOnboardingTable.computerId, computerId),
                    ne(serverOnboardingTable.phase, 'complete'),
                    or(
                        isNull(serverOnboardingTable.failureCode),
                        ne(serverOnboardingTable.failureCode, 'application-failed')
                    )
                )
            );
    });
}

export async function recordInvalidComputerInventory(
    db: GrottoDatabase,
    computerId: string,
    serverId: string
) {
    await db
        .update(serverOnboardingTable)
        .set({
            computerId,
            failureCode: 'inventory-invalid',
            failureDetail: 'The Computer reported invalid inventory. Update it and reconnect.',
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(serverOnboardingTable.serverId, serverId),
                ne(serverOnboardingTable.phase, 'complete'),
                or(
                    eq(serverOnboardingTable.phase, 'awaiting-computer'),
                    eq(serverOnboardingTable.computerId, computerId)
                )
            )
        );
}

/** Process startup has no live attachment registry, so persisted online state is stale. */
export async function markAllComputersOffline(db: GrottoDatabase) {
    await db.transaction(async (tx) => {
        await tx.update(computersTable).set({ health: 'offline' });
        await tx
            .update(serverOnboardingTable)
            .set({
                failureCode: 'computer-disconnected',
                failureDetail: 'The Computer disconnected. Run setup again on that Computer.',
                updatedAt: new Date(),
            })
            .where(
                and(
                    isNotNull(serverOnboardingTable.computerId),
                    ne(serverOnboardingTable.phase, 'complete'),
                    or(
                        isNull(serverOnboardingTable.failureCode),
                        ne(serverOnboardingTable.failureCode, 'application-failed')
                    )
                )
            );
    });
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
    const computers = await db
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
            updateDownloadedBytes: computersTable.updateDownloadedBytes,
            updateFailedPhase: computersTable.updateFailedPhase,
            updatePhase: computersTable.updatePhase,
            updateActiveAgentCount: computersTable.updateActiveAgentCount,
            updateTargetVersion: computersTable.updateTargetVersion,
            updateTotalBytes: computersTable.updateTotalBytes,
            updateUpdatedAt: computersTable.updateUpdatedAt,
        })
        .from(computersTable)
        .where(eq(computersTable.serverId, serverId))
        .orderBy(desc(computersTable.createdAt));
    return computers.map((computer) => ({
        ...computer,
        name: computer.reportedInventory?.name ?? null,
    }));
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
                    eq(agentsTable.computerId, computer.id),
                    isNull(agentsTable.retiredAt)
                )
            )
            .limit(1);
        if (assigned) {
            throw new ComputerSetupDeniedError(
                'Delete every assigned Agent before removing this Computer.'
            );
        }
        await tx
            .update(serverOnboardingTable)
            .set({ computerId: null })
            .where(
                and(
                    eq(serverOnboardingTable.serverId, input.serverId),
                    eq(serverOnboardingTable.computerId, computer.id),
                    eq(serverOnboardingTable.phase, 'complete')
                )
            );
        await tx
            .update(serverOnboardingTable)
            .set({
                computerId: null,
                failureCode: null,
                failureDetail: null,
                phase: 'awaiting-computer',
            })
            .where(
                and(
                    eq(serverOnboardingTable.serverId, input.serverId),
                    eq(serverOnboardingTable.computerId, computer.id),
                    ne(serverOnboardingTable.phase, 'complete')
                )
            );
        await tx
            .update(agentsTable)
            .set({ computerId: null, desiredModelId: null, desiredRuntimeId: null })
            .where(
                and(
                    eq(agentsTable.serverId, input.serverId),
                    eq(agentsTable.computerId, computer.id)
                )
            );
        await tx.delete(computersTable).where(eq(computersTable.id, computer.id));
        return { computerId: computer.id };
    });
}
