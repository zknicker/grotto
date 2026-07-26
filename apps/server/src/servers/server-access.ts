import { and, asc, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { channelsTable, serverMembershipsTable, serversTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import type { ServerDetail, ServerRole, ServerSummary } from './contracts.ts';

export class ServerNotFoundError extends Error {
    constructor(address: string) {
        super(`No Grotto server exists at ${address}.`);
        this.name = 'ServerNotFoundError';
    }
}

export class ServerAccessDeniedError extends Error {
    constructor() {
        super('You are not a member of this Grotto server.');
        this.name = 'ServerAccessDeniedError';
    }
}

/**
 * The one authorization gate for Server-scoped work. Every query, mutation, and
 * subscription resolves membership through here before touching Server state.
 * A human with no Grotto User yet is simply not a member.
 */
export async function requireServerMembership(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
): Promise<ServerSummary> {
    const [server] = await db
        .select({
            displayName: serversTable.displayName,
            id: serversTable.id,
            role: serverMembershipsTable.role,
            slug: serversTable.slug,
        })
        .from(serversTable)
        .leftJoin(
            serverMembershipsTable,
            and(
                eq(serverMembershipsTable.serverId, serversTable.id),
                eq(serverMembershipsTable.userId, member?.id ?? '')
            )
        )
        .where(eq(serversTable.id, serverId))
        .limit(1);

    if (!server) {
        throw new ServerNotFoundError(serverId);
    }

    if (server.role === null) {
        throw new ServerAccessDeniedError();
    }

    return { ...server, role: server.role as ServerRole };
}

/** Opens one Grotto server at its human-facing address, with its Channels. */
export async function openServerBySlug(
    db: GrottoDatabase,
    member: GrottoUser | null,
    slug: string
): Promise<ServerDetail> {
    const [found] = await db
        .select({ id: serversTable.id })
        .from(serversTable)
        .where(eq(serversTable.slug, slug))
        .limit(1);

    if (!found) {
        throw new ServerNotFoundError(`/${slug}`);
    }

    const server = await requireServerMembership(db, member, found.id);
    const channels = await db
        .select({ id: channelsTable.id, name: channelsTable.name })
        .from(channelsTable)
        .where(eq(channelsTable.serverId, server.id))
        .orderBy(asc(channelsTable.name));

    return { ...server, channels };
}
