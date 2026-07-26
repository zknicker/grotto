import type { HostedChat } from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { visibleHostedChats } from './chat-visibility.ts';

export async function listHostedChats(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
): Promise<HostedChat[]> {
    await requireServerMembership(db, member, serverId);

    if (!member) {
        return [];
    }

    const rows = await db
        .select({
            createdAt: chatsTable.createdAt,
            id: chatsTable.id,
            isAll: chatsTable.isAll,
            kind: chatsTable.kind,
            lastActivityAt: chatsTable.lastActivityAt,
            lastMessageSequence: chatsTable.lastMessageSequence,
            name: chatsTable.name,
            participantUserIds: sql<string[]>`
                case
                    when ${chatsTable.kind} = 'dm'
                        then array[
                            ${chatsTable.dmMemberOneUserId},
                            ${chatsTable.dmMemberTwoUserId}
                        ]::text[]
                    else array(
                        select participant.user_id
                        from channel_participants participant
                        where participant.server_id = "chats"."server_id"
                            and participant.chat_id = "chats"."id"
                        order by participant.user_id
                    )
                end
            `,
            peerUserId: sql<string | null>`
                case
                    when ${chatsTable.kind} = 'dm'
                        then case
                            when ${chatsTable.dmMemberOneUserId} = ${member.id}
                                then ${chatsTable.dmMemberTwoUserId}
                            else ${chatsTable.dmMemberOneUserId}
                        end
                    else null
                end
            `,
            serverId: chatsTable.serverId,
            unreadCount: sql<number>`
                (
                    select count(*)::integer
                    from chat_messages message
                    where message.server_id = "chats"."server_id"
                        and message.chat_id = "chats"."id"
                        and message.author_user_id <> ${member.id}
                        and message.sequence > coalesce(
                            (
                                select read.sequence
                                from chat_reads read
                                where read.server_id = "chats"."server_id"
                                    and read.chat_id = "chats"."id"
                                    and read.reader_user_id = ${member.id}
                            ),
                            0
                        )
                )
            `,
        })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, serverId), visibleHostedChats(member.id)))
        .orderBy(sql`${chatsTable.lastActivityAt} desc nulls last`, chatsTable.createdAt);

    return rows.map((chat) => ({
        ...chat,
        createdAt: chat.createdAt.toISOString(),
        lastActivityAt: chat.lastActivityAt?.toISOString() ?? null,
    }));
}
