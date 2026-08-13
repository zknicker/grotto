import { and, eq } from 'drizzle-orm';
import { requireChatWritable } from '../chats/chat-access.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { messageReactionsTable } from '../postgres/schema.ts';
import { resolveAgentMessage } from './message-read.ts';

export async function changeAgentReaction(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: { emoji: string; messageId: string; remove: boolean }
) {
    const visibleMessage = await resolveAgentMessage(db, runner, input.messageId);
    await requireChatWritable(db, {
        chatId: visibleMessage.chat_id,
        serverId: runner.serverId,
    });
    if (input.remove) {
        await db
            .delete(messageReactionsTable)
            .where(
                and(
                    eq(messageReactionsTable.serverId, runner.serverId),
                    eq(messageReactionsTable.messageId, visibleMessage.id),
                    eq(messageReactionsTable.actorAgentId, runner.agentId),
                    eq(messageReactionsTable.emoji, input.emoji)
                )
            );
    } else {
        await db
            .insert(messageReactionsTable)
            .values({
                actorAgentId: runner.agentId,
                emoji: input.emoji,
                messageId: visibleMessage.id,
                serverId: runner.serverId,
            })
            .onConflictDoNothing();
    }
    return { message: await resolveAgentMessage(db, runner, visibleMessage.id) };
}
