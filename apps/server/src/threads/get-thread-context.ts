import { and, eq } from 'drizzle-orm';
import { requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export async function getThreadContext(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { serverId: string; threadChatId: string }
) {
    const thread = await requireChatAccess(db, member, {
        chatId: input.threadChatId,
        serverId: input.serverId,
    });

    if (thread.kind !== 'thread') {
        throw new Error('The requested Chat is not a Thread.');
    }

    const [context] = await db
        .select({
            anchorMessageId: chatsTable.anchorMessageId,
            parentChatId: chatsTable.parentChatId,
        })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.threadChatId)))
        .limit(1);

    if (!(context?.anchorMessageId && context.parentChatId)) {
        throw new Error('The Thread has no parent context.');
    }

    return {
        anchorMessageId: context.anchorMessageId,
        parentChatId: context.parentChatId,
        serverId: input.serverId,
        threadChatId: input.threadChatId,
    };
}
