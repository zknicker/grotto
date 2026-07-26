import { type SQL, sql } from 'drizzle-orm';
import { chatsTable } from '../postgres/schema.ts';

/** The canonical DM-pair-or-Channel-participant visibility rule. */
export function visibleHostedChats(userId: string): SQL {
    return sql`(
        (
            ${chatsTable.kind} = 'dm'
            and (
                ${chatsTable.dmMemberOneUserId} = ${userId}
                or ${chatsTable.dmMemberTwoUserId} = ${userId}
            )
        )
        or exists (
            select 1
            from channel_participants participant
            where participant.server_id = ${chatsTable.serverId}
                and participant.chat_id = ${chatsTable.id}
                and participant.user_id = ${userId}
        )
    )`;
}
