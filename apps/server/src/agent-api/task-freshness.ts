import { and, eq, gt, ne, or, sql } from 'drizzle-orm';
import { readAgentInboxCursor } from '../agent-delivery/cursors.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatMessagesTable, chatsTable } from '../postgres/schema.ts';

export async function hasUnseenTaskThreadContext(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    messageId: string
) {
    const threadChatId = `cht_thr_${messageId.replace(/^msg_/u, '')}`;
    const [thread] = await db
        .select({ latest: chatsTable.lastMessageSequence })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, runner.serverId), eq(chatsTable.id, threadChatId)))
        .limit(1);
    if (!thread || thread.latest === 0) {
        return false;
    }
    const cursor = await readAgentInboxCursor(db, { ...runner, chatId: threadChatId });
    const horizon = Math.max(cursor.seen, cursor.served);
    if (thread.latest <= horizon) {
        return false;
    }
    const [newer] = await db
        .select({ id: chatMessagesTable.id })
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, runner.serverId),
                eq(chatMessagesTable.chatId, threadChatId),
                gt(chatMessagesTable.sequence, horizon),
                or(
                    sql`${chatMessagesTable.authorUserId} is not null`,
                    and(
                        sql`${chatMessagesTable.authorAgentId} is not null`,
                        ne(chatMessagesTable.authorAgentId, runner.agentId)
                    )
                )
            )
        )
        .limit(1);
    return Boolean(newer);
}
