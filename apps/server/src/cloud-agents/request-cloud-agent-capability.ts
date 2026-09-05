import type { CloudAgentCapabilityRequest, CloudAgentCapabilityResult } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import type { ComputerConnections } from '../computers/connections.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computersTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export class CloudAgentCapabilityDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CloudAgentCapabilityDeniedError';
    }
}

/**
 * Reads or changes one Computer's Cloud Agent provider access. Server carries
 * no provider credential and stores none: it verifies authority, verifies the
 * Computer belongs to this Server, and relays the operation to that Computer's
 * outbound socket, exactly as Browser settings do. The browser sign-in happens
 * on the Computer, and only the resulting readiness comes back.
 */
export async function requestCloudAgentCapability(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: {
        computerId: string;
        operation: CloudAgentCapabilityRequest['operation'];
        provider: CloudAgentCapabilityRequest['provider'];
        serverId: string;
    }
): Promise<NonNullable<CloudAgentCapabilityResult['result']>> {
    const server = await requireServerMembership(db, member, input.serverId);
    if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
        throw new CloudAgentCapabilityDeniedError(
            'Only a Server Owner or Admin can connect a Computer to a Cloud Agent provider.'
        );
    }
    const [computer] = await db
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
        throw new CloudAgentCapabilityDeniedError('That Computer is not attached to this Server.');
    }

    try {
        return await connections.requestCloudAgentCapability(computer.id, {
            operation: input.operation,
            provider: input.provider,
        });
    } catch (cause) {
        throw new CloudAgentCapabilityDeniedError(
            cause instanceof Error ? cause.message : 'The Cloud Agent request failed.'
        );
    }
}
