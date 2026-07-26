import { and, eq, or, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { channelParticipantsTable, chatReadsTable, chatsTable } from '../postgres/schema.ts';

type PersonalWorkWriter = Pick<GrottoDatabase, 'delete' | 'insert' | 'select'>;

/**
 * The hosted personal work one human holds on one Server today: which Channels
 * they participate in and how far they have read. Authored messages, their
 * attachments, and DM pairs are deliberately untouched — those are collaboration
 * history, not personal work, and the membership row stays in place so they keep
 * resolving.
 *
 * Clearing returns every Chat the human just lost, so a caller that also
 * revokes access can tell live surfaces to drop their volatile state.
 */
export async function clearHostedPersonalWork(
    db: PersonalWorkWriter,
    serverId: string,
    userId: string
): Promise<string[]> {
    const departed = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, serverId),
                or(
                    eq(chatsTable.dmMemberOneUserId, userId),
                    eq(chatsTable.dmMemberTwoUserId, userId),
                    sql`exists (
                        select 1 from channel_participants participant
                        where participant.server_id = ${serverId}
                            and participant.chat_id = ${chatsTable.id}
                            and participant.user_id = ${userId}
                    )`
                )
            )
        );

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
