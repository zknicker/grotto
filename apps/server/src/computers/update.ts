import {
    type ComputerUpdateProgress,
    computerProtocolVersion,
    type SignedComputerRelease,
    signedComputerReleaseSchema,
} from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computersTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import type { ComputerConnections } from './connections.ts';
import { ComputerSetupDeniedError } from './service.ts';

export const productionComputerManifestUrl = 'https://releases.grotto.sh/computer/latest.json';

export async function checkComputerUpdate(input: {
    computerId: string;
    db: GrottoDatabase;
    manifestUrl: string;
    member: GrottoUser | null;
    serverId: string;
}) {
    const computer = await requireComputerAdmin(input);
    await setChecking(input.db, computer.id);
    try {
        const release = await fetchProductionRelease(input.manifestUrl);
        assertCompatibleProductionRelease(release);
        const available = isNewer(release.release.version, computer.productVersion);
        await input.db
            .update(computersTable)
            .set({
                updateDetail: available
                    ? `Grotto Computer ${release.release.version} is available.`
                    : currentVersionDetail(release.release.version),
                updatePhase: available ? 'available' : 'idle',
                updateTargetVersion: release.release.version,
                updateUpdatedAt: new Date(),
            })
            .where(eq(computersTable.id, computer.id));
        return { available, version: release.release.version };
    } catch (cause) {
        await recordFailure(input.db, computer.id, cause, 'checking');
        throw cause;
    }
}

export async function startComputerUpdate(input: {
    computerId: string;
    connections: ComputerConnections;
    db: GrottoDatabase;
    manifestUrl: string;
    member: GrottoUser | null;
    serverId: string;
}) {
    const computer = await requireComputerAdmin(input);
    await setChecking(input.db, computer.id);
    let failedPhase: ComputerUpdateProgress['failedPhase'] = 'checking';
    try {
        const release = await fetchProductionRelease(input.manifestUrl);
        assertCompatibleProductionRelease(release);
        if (!isNewer(release.release.version, computer.productVersion)) {
            await input.db
                .update(computersTable)
                .set({
                    updateDetail: currentVersionDetail(release.release.version),
                    updatePhase: 'idle',
                    updateTargetVersion: release.release.version,
                    updateUpdatedAt: new Date(),
                })
                .where(eq(computersTable.id, computer.id));
            return { started: false, version: release.release.version };
        }
        await input.db
            .update(computersTable)
            .set({
                updateActiveAgentCount: null,
                updateDetail: 'Download requested.',
                updateDownloadedBytes: null,
                updateFailedPhase: null,
                updatePhase: 'requested',
                updateTargetVersion: release.release.version,
                updateTotalBytes: null,
                updateUpdatedAt: new Date(),
            })
            .where(eq(computersTable.id, computer.id));
        failedPhase = 'requested';
        if (!input.connections.sendUpdate(computer.id, release)) {
            throw new ComputerSetupDeniedError('This Computer is offline.');
        }
        return { started: true, version: release.release.version };
    } catch (cause) {
        await recordFailure(input.db, computer.id, cause, failedPhase);
        throw cause;
    }
}

async function requireComputerAdmin(input: {
    computerId: string;
    db: GrottoDatabase;
    member: GrottoUser | null;
    serverId: string;
}) {
    const membership = await requireServerMembership(input.db, input.member, input.serverId);
    if (membership.role !== 'owner' && membership.role !== 'admin') {
        throw new ComputerSetupDeniedError('Only a Server Owner or Admin can update a Computer.');
    }
    const [computer] = await input.db
        .select({
            id: computersTable.id,
            productVersion: computersTable.productVersion,
        })
        .from(computersTable)
        .where(
            and(
                eq(computersTable.id, input.computerId),
                eq(computersTable.serverId, input.serverId)
            )
        )
        .limit(1);
    if (!computer) {
        throw new ComputerSetupDeniedError('That Computer is not attached to this Server.');
    }
    return computer;
}

async function fetchProductionRelease(manifestUrl: string): Promise<SignedComputerRelease> {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
        throw new Error(`Production Computer release check failed (${response.status}).`);
    }
    return signedComputerReleaseSchema.parse(await response.json());
}

async function setChecking(db: GrottoDatabase, computerId: string) {
    await db
        .update(computersTable)
        .set({
            updateDetail: 'Checking the production release.',
            updatePhase: 'checking',
            updateUpdatedAt: new Date(),
        })
        .where(eq(computersTable.id, computerId));
}

async function recordFailure(
    db: GrottoDatabase,
    computerId: string,
    cause: unknown,
    failedPhase: ComputerUpdateProgress['failedPhase']
) {
    await db
        .update(computersTable)
        .set({
            updateDetail: cause instanceof Error ? cause.message : 'Computer update failed.',
            updateFailedPhase: failedPhase,
            updatePhase: 'failed',
            updateUpdatedAt: new Date(),
        })
        .where(eq(computersTable.id, computerId));
}

function isNewer(candidate: string, installed: string | null): boolean {
    if (!installed) {
        return true;
    }
    const candidateParts = parseVersion(candidate);
    const installedParts = parseVersion(installed);
    for (let index = 0; index < 3; index += 1) {
        if (candidateParts[index] !== installedParts[index]) {
            return (candidateParts[index] ?? 0) > (installedParts[index] ?? 0);
        }
    }
    return false;
}

function currentVersionDetail(version: string): string {
    return `Grotto Computer ${version} is the latest version.`;
}

function parseVersion(version: string): number[] {
    const match = /^(\d+)\.(\d+)\.(\d+)/u.exec(version);
    if (!match) {
        throw new Error(`Invalid Computer release version "${version}".`);
    }
    return match.slice(1).map(Number);
}

function assertCompatibleProductionRelease(release: SignedComputerRelease) {
    if (release.release.protocolVersion !== computerProtocolVersion) {
        throw new Error(
            `Production Grotto Computer ${release.release.version} does not satisfy protocol ${computerProtocolVersion}.`
        );
    }
}
