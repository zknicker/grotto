import { sql } from 'drizzle-orm';
import { allocateEventCursor } from '../chats/allocate-event-cursor.ts';
import { requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, threadFollowsTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export async function setThreadFollow(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { follow: boolean; serverId: string; threadChatId: string }
) {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);

        const thread = await requireChatAccess(tx, member, {
            chatId: input.threadChatId,
            serverId: input.serverId,
        });

        if (!(member && thread.kind === 'thread')) {
            throw new Error('Thread follow state requires a child Thread.');
        }

        await tx
            .insert(threadFollowsTable)
            .values({
                followed: input.follow,
                serverId: input.serverId,
                threadChatId: input.threadChatId,
                userId: member.id,
            })
            .onConflictDoUpdate({
                set: { followed: input.follow, updatedAt: sql`now()` },
                target: [
                    threadFollowsTable.serverId,
                    threadFollowsTable.threadChatId,
                    threadFollowsTable.userId,
                ],
            });
        const eventCursor = await allocateEventCursor(tx, input.serverId);
        const [event] = await tx
            .insert(chatEventsTable)
            .values({
                chatId: input.threadChatId,
                cursor: eventCursor,
                id: createOpaqueId('evt'),
                readerUserId: member.id,
                sequence: thread.lastMessageSequence,
                serverId: input.serverId,
                type: 'thread.follow.updated',
            })
            .returning({
                createdAt: chatEventsTable.createdAt,
                cursor: chatEventsTable.cursor,
                id: chatEventsTable.id,
            });

        return {
            event: {
                chatId: input.threadChatId,
                createdAt: event.createdAt.toISOString(),
                cursor: event.cursor.toString(),
                id: event.id,
                parentChatId: thread.parentChatId as string,
                sequence: thread.lastMessageSequence,
                serverId: input.serverId,
                type: 'thread.follow.updated' as const,
            },
            receipt: {
                eventCursor: event.cursor.toString(),
                followed: input.follow,
                serverId: input.serverId,
                threadChatId: input.threadChatId,
            },
        };
    });
}
