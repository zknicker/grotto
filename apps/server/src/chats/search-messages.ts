import type { HostedChatMessage } from '@tavern/api';
import { and, eq, ne, sql } from 'drizzle-orm';
import { readMessageAttachments } from '../attachments/message-attachments.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentsTable,
    chatMessagesTable,
    chatsTable,
    serverMembershipsTable,
    usersTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireChatAccess } from './chat-access.ts';
import { visibleHostedChats } from './chat-visibility.ts';
import { readStoredAuthorProfile, toHostedChatMessage } from './message-shape.ts';

export async function searchHostedChatMessages(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { chatId?: string; limit: number; query: string; serverId: string }
): Promise<HostedChatMessage[]> {
    await requireServerMembership(db, member, input.serverId);

    if (!member) {
        return [];
    }

    if (input.chatId) {
        await requireChatAccess(db, member, {
            chatId: input.chatId,
            serverId: input.serverId,
        });
    }

    const rows = await db
        .select({
            authorAgentId: chatMessagesTable.authorAgentId,
            authorUserId: chatMessagesTable.authorUserId,
            chatId: chatMessagesTable.chatId,
            content: chatMessagesTable.content,
            createdAt: chatMessagesTable.createdAt,
            id: chatMessagesTable.id,
            nonce: chatMessagesTable.nonce,
            sequence: chatMessagesTable.sequence,
            serverId: chatMessagesTable.serverId,
            systemAuthor: chatMessagesTable.systemAuthor,
            authorAgentAvatarId: agentsTable.avatarId,
            authorAgentDescription: agentsTable.description,
            authorAgentDisplayName: agentsTable.displayName,
            authorAgentRetiredAt: agentsTable.retiredAt,
            authorUserAvatarId: usersTable.avatarId,
            authorUserDescription: usersTable.description,
            authorUserDisplayName: usersTable.displayName,
            authorUserRevokedAt: serverMembershipsTable.revokedAt,
        })
        .from(chatMessagesTable)
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, chatMessagesTable.serverId),
                eq(chatsTable.id, chatMessagesTable.chatId)
            )
        )
        .leftJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, chatMessagesTable.serverId),
                eq(agentsTable.id, chatMessagesTable.authorAgentId)
            )
        )
        .leftJoin(usersTable, eq(usersTable.id, chatMessagesTable.authorUserId))
        .leftJoin(
            serverMembershipsTable,
            and(
                eq(serverMembershipsTable.serverId, chatMessagesTable.serverId),
                eq(serverMembershipsTable.userId, chatMessagesTable.authorUserId)
            )
        )
        .where(
            and(
                eq(chatMessagesTable.serverId, input.serverId),
                ne(chatsTable.kind, 'thread'),
                input.chatId ? eq(chatMessagesTable.chatId, input.chatId) : undefined,
                sql`${chatMessagesTable.searchVector}
                    @@ websearch_to_tsquery('simple', ${input.query})`,
                visibleHostedChats(member.id)
            )
        )
        .orderBy(sql`${chatMessagesTable.createdAt} desc`, sql`${chatMessagesTable.id} desc`)
        .limit(input.limit);

    const attachments = await readMessageAttachments(
        db,
        input.serverId,
        rows.map((message) => message.id)
    );

    return rows.map((message) =>
        toHostedChatMessage(
            message,
            attachments.get(message.id) ?? [],
            readStoredAuthorProfile(message)
        )
    );
}
