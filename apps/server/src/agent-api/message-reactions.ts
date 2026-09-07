import { and, eq, inArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable, messageReactionsTable } from '../postgres/schema.ts';

export async function readMessageReactions(
    db: GrottoDatabase,
    serverId: string,
    messageIds: string[]
) {
    const byMessage = new Map<
        string,
        Array<{ actors: Array<{ handle: string; id: string }>; emoji: string }>
    >();
    if (messageIds.length === 0) {
        return byMessage;
    }
    const rows = await db
        .select({
            actorId: messageReactionsTable.actorAgentId,
            emoji: messageReactionsTable.emoji,
            handle: agentsTable.handle,
            messageId: messageReactionsTable.messageId,
        })
        .from(messageReactionsTable)
        .innerJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, messageReactionsTable.serverId),
                eq(agentsTable.id, messageReactionsTable.actorAgentId)
            )
        )
        .where(
            and(
                eq(messageReactionsTable.serverId, serverId),
                inArray(messageReactionsTable.messageId, messageIds)
            )
        );
    for (const row of rows) {
        const reactions = byMessage.get(row.messageId) ?? [];
        const reaction = reactions.find(({ emoji }) => emoji === row.emoji);
        if (reaction) {
            reaction.actors.push({ handle: row.handle, id: row.actorId });
        } else {
            reactions.push({
                actors: [{ handle: row.handle, id: row.actorId }],
                emoji: row.emoji,
            });
        }
        byMessage.set(row.messageId, reactions);
    }
    return byMessage;
}
