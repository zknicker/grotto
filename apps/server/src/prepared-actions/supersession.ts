import { and, desc, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatMessagesTable, preparedActionsTable } from '../postgres/schema.ts';

export interface PendingPreparedAction {
    id: string;
    messageId: string;
    sequence: number;
}

export async function supersedePendingPreparedActions(
    db: GrottoDatabase,
    input: {
        chatId: string;
        kind: 'agent:create';
        proposerAgentId: string;
        serverId: string;
    },
    supersededByActionId: string
): Promise<PendingPreparedAction[]> {
    const previous = await db
        .select({
            id: preparedActionsTable.id,
            messageId: preparedActionsTable.messageId,
            sequence: chatMessagesTable.sequence,
        })
        .from(preparedActionsTable)
        .innerJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, preparedActionsTable.serverId),
                eq(chatMessagesTable.id, preparedActionsTable.messageId)
            )
        )
        .where(
            and(
                eq(preparedActionsTable.serverId, input.serverId),
                eq(preparedActionsTable.chatId, input.chatId),
                eq(preparedActionsTable.proposerAgentId, input.proposerAgentId),
                eq(preparedActionsTable.kind, input.kind),
                eq(preparedActionsTable.status, 'pending')
            )
        )
        .orderBy(desc(preparedActionsTable.createdAt));

    if (previous.length === 0) {
        return previous;
    }

    await db
        .update(preparedActionsTable)
        .set({
            status: 'superseded',
            supersededAt: new Date(),
            supersededByActionId,
        })
        .where(
            and(
                eq(preparedActionsTable.serverId, input.serverId),
                eq(preparedActionsTable.chatId, input.chatId),
                eq(preparedActionsTable.proposerAgentId, input.proposerAgentId),
                eq(preparedActionsTable.kind, input.kind),
                eq(preparedActionsTable.status, 'pending')
            )
        );
    return previous;
}
