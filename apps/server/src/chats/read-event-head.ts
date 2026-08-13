import { eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { serversTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export async function readChatEventHead(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
): Promise<{ cursor: string }> {
    await requireServerMembership(db, member, serverId);

    const [server] = await db
        .select({ cursor: serversTable.lastChatEventCursor })
        .from(serversTable)
        .where(eq(serversTable.id, serverId))
        .limit(1);

    if (!server) {
        throw new Error('Failed to read the Server Chat event head.');
    }

    return { cursor: server.cursor.toString() };
}
