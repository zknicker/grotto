import { and, eq } from 'drizzle-orm';
import { visibleHostedChats } from '../chats/chat-visibility.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    channelParticipantsTable,
    chatReadsTable,
    chatsTable,
    threadFollowsTable,
} from '../postgres/schema.ts';

type PersonalWorkWriter = Pick<GrottoDatabase, 'delete' | 'insert' | 'select'>;

/**
 * The hosted personal work one human holds on one Server today: Channel
 * participation, read markers, and Thread follows. Authored messages, DMs, and
 * Threads are deliberately untouched — those are collaboration history, not
 * personal work, and the membership row stays in place so they keep resolving
 * for participants whose stint did not end.
 *
 * Clearing returns every Chat the human just lost, including child Threads, so
 * a caller that also revokes access can retire live composition state.
 */
export async function clearHostedPersonalWork(
    db: PersonalWorkWriter,
    serverId: string,
    userId: string
): Promise<string[]> {
    const departed = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, serverId), visibleHostedChats(userId)));

    await db
        .delete(channelParticipantsTable)
        .where(
            and(
                eq(channelParticipantsTable.serverId, serverId),
                eq(channelParticipantsTable.userId, userId)
            )
        );
    await db
        .delete(chatReadsTable)
        .where(and(eq(chatReadsTable.serverId, serverId), eq(chatReadsTable.readerUserId, userId)));
    await db
        .delete(threadFollowsTable)
        .where(
            and(eq(threadFollowsTable.serverId, serverId), eq(threadFollowsTable.userId, userId))
        );

    return departed.map((chat) => chat.id);
}

/** Joins one human to the Channel every Grotto server creates for everyone. */
export async function joinAllChannel(
    db: Pick<GrottoDatabase, 'insert' | 'select'>,
    serverId: string,
    userId: string
): Promise<void> {
    const [allChannel] = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, serverId), eq(chatsTable.isAll, true)))
        .limit(1);

    if (!allChannel) {
        throw new Error('This Grotto server has no #all Channel to join.');
    }

    await db
        .insert(channelParticipantsTable)
        .values({ chatId: allChannel.id, serverId, userId })
        .onConflictDoNothing();
}
