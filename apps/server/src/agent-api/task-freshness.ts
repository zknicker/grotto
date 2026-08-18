import { and, eq, gt, ne, or, sql } from 'drizzle-orm';
import { readAgentInboxCursor } from '../agent-delivery/cursors.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentInboxExactVisibilityTable,
    chatMessagesTable,
    chatsTable,
} from '../postgres/schema.ts';

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
    const horizon = cursor.seen;
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
                sql`not exists (
                    select 1 from ${agentInboxExactVisibilityTable} exact_visibility
                    where exact_visibility.server_id = ${runner.serverId}
                      and exact_visibility.agent_id = ${runner.agentId}
                      and exact_visibility.session_generation = ${cursor.generation}
                      and exact_visibility.chat_id = ${threadChatId}
                      and exact_visibility.message_id = ${chatMessagesTable.id}
                      and (
                        exact_visibility.seen_at is not null
                        or exact_visibility.served_run_id = ${runner.runId}
                      )
                )`,
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
