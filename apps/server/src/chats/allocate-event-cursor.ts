import { eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { serversTable } from '../postgres/schema.ts';

type EventCursorWriter = Pick<GrottoDatabase, 'update'>;

/**
 * Serializes durable event allocation per Server. The row lock is held through
 * commit, so a visible higher cursor can never precede an invisible lower one.
 */
export async function allocateHostedEventCursor(
    db: EventCursorWriter,
    serverId: string
): Promise<bigint> {
    const [server] = await db
        .update(serversTable)
        .set({
            lastChatEventCursor: sql`${serversTable.lastChatEventCursor} + 1`,
        })
        .where(eq(serversTable.id, serverId))
        .returning({ cursor: serversTable.lastChatEventCursor });

    if (!server) {
        throw new Error('Failed to allocate the Server Chat event cursor.');
    }

    return server.cursor;
}
