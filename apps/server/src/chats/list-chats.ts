import type { HostedChat } from '@tavern/api';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable, chatsTable, serverOnboardingTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { readHostedThreadAttentionCounts } from '../threads/thread-attention.ts';
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
            kind: sql<'channel' | 'dm'>`${chatsTable.kind}`,
            lastActivityAt: chatsTable.lastActivityAt,
            lastMessageSequence: chatsTable.lastMessageSequence,
            name: chatsTable.name,
            participantAgentIds: sql<string[]>`
                case
                    when ${chatsTable.kind} = 'dm'
                        then array_remove(array[${chatsTable.dmAgentId}], null)::text[]
                    else array(
                        select participant.agent_id
                        from channel_agent_participants participant
                        where participant.server_id = "chats"."server_id"
                            and participant.chat_id = "chats"."id"
                        order by participant.agent_id
                    )
                end
            `,
            participantUserIds: sql<string[]>`
                case
                    when ${chatsTable.kind} = 'dm'
                        then array_remove(array[
                            ${chatsTable.dmMemberOneUserId},
                            ${chatsTable.dmMemberTwoUserId}
                        ], null)::text[]
                    else array(
                        select participant.user_id
                        from channel_participants participant
                        where participant.server_id = "chats"."server_id"
                            and participant.chat_id = "chats"."id"
                        order by participant.user_id
                    )
                end
            `,
            peerAgentDisplayName: sql<string | null>`
                case
                    when ${chatsTable.kind} = 'dm' then ${agentsTable.displayName}
                    else null
                end
            `,
            peerAgentId: sql<string | null>`
                case
                    when ${chatsTable.kind} = 'dm' then ${chatsTable.dmAgentId}
                    else null
                end
            `,
            peerAgentRetired: sql<boolean>`${agentsTable.retiredAt} is not null`,
            peerUserId: sql<string | null>`
                case
                    when ${chatsTable.kind} = 'dm' and ${chatsTable.dmAgentId} is null
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
                        and (
                            message.author_user_id is null
                            or message.author_user_id <> ${member.id}
                        )
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
        .leftJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, chatsTable.serverId),
                eq(agentsTable.id, chatsTable.dmAgentId)
            )
        )
        .innerJoin(serverOnboardingTable, eq(serverOnboardingTable.serverId, chatsTable.serverId))
        .where(
            and(
                eq(chatsTable.serverId, serverId),
                or(
                    ne(chatsTable.id, serverOnboardingTable.channelId),
                    eq(serverOnboardingTable.phase, 'complete')
                ),
                ne(chatsTable.kind, 'thread'),
                or(
                    ne(chatsTable.kind, 'dm'),
                    isNull(chatsTable.dmAgentId),
                    isNull(agentsTable.retiredAt)
                ),
                visibleHostedChats(member.id)
            )
        )
        .orderBy(sql`${chatsTable.lastActivityAt} desc nulls last`, chatsTable.createdAt);

    const threadAttentionCounts = await readHostedThreadAttentionCounts(db, {
        parentChatIds: rows.map((chat) => chat.id),
        readerUserId: member.id,
        serverId,
    });

    return rows.map((chat) => ({
        ...chat,
        createdAt: chat.createdAt.toISOString(),
        lastActivityAt: chat.lastActivityAt?.toISOString() ?? null,
        unreadCount: chat.unreadCount + (threadAttentionCounts.get(chat.id) ?? 0),
    }));
}
