import type { BrowserRequest, BrowserResult } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { ComputerConnections } from '../computers/connections.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computersTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export class BrowserDeniedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BrowserDeniedError';
    }
}

export async function requestBrowser(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: {
        computerId: string;
        operation: BrowserRequest['operation'];
        serverId: string;
    }
): Promise<NonNullable<BrowserResult['result']>> {
    const server = await requireServerMembership(db, member, input.serverId);
    if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
        throw new BrowserDeniedError('Only a Server Owner or Admin can manage a Computer Browser.');
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
        throw new BrowserDeniedError('That Computer is not attached to this Server.');
    }

    try {
        return await connections.requestBrowser(computer.id, input.operation);
    } catch (cause) {
        throw new BrowserDeniedError(
            cause instanceof Error ? cause.message : 'The Browser request failed.'
        );
    }
}
