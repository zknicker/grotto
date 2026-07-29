import type { HostedBrowserRequest, HostedBrowserResult } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { ComputerConnections } from '../computers/connections.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computersTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export class HostedBrowserDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HostedBrowserDeniedError';
    }
}

export async function requestHostedBrowser(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: {
        computerId: string;
        operation: HostedBrowserRequest['operation'];
        serverId: string;
    }
): Promise<NonNullable<HostedBrowserResult['result']>> {
    const server = await requireServerMembership(db, member, input.serverId);
    if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
        throw new HostedBrowserDeniedError(
            'Only a Server Owner or Admin can manage a Computer Browser.'
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
        throw new HostedBrowserDeniedError('That Computer is not attached to this Server.');
    }

    try {
        return await connections.requestBrowser(computer.id, input.operation);
    } catch (cause) {
        throw new HostedBrowserDeniedError(
            cause instanceof Error ? cause.message : 'The Browser request failed.'
        );
    }
}
