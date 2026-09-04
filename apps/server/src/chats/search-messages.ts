import type { ChatSearchResult } from '@grotto/api';
import { and, eq, gte, isNull, ne, sql } from 'drizzle-orm';
import { readMessageAttachments } from '../attachments/message-attachments.ts';
import { readMessageCauses } from '../automations/message-cause-read.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentsTable,
    chatMessagesTable,
    chatsTable,
    serverMembershipsTable,
    usersTable,
} from '../postgres/schema.ts';
import { readPreparedActionsForMessages } from '../prepared-actions/read.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireChatAccess } from './chat-access.ts';
import { visibleChats } from './chat-visibility.ts';
import { readMessageBodies } from './message-bodies.ts';
import { readStoredAuthorProfile, toChatMessage } from './message-shape.ts';

export async function searchChatMessages(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: {
        after?: string;
        authorAgentId?: string;
        authorUserId?: string;
        chatId?: string;
        limit: number;
        query: string;
        serverId: string;
    }
): Promise<ChatSearchResult[]> {
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
            bodyKind: chatMessagesTable.bodyKind,
            chatId: chatMessagesTable.chatId,
            chatArchivedAt: chatsTable.archivedAt,
            content: chatMessagesTable.content,
            createdAt: chatMessagesTable.createdAt,
            id: chatMessagesTable.id,
            nonce: chatMessagesTable.nonce,
            runId: chatMessagesTable.runId,
            sequence: chatMessagesTable.sequence,
            serverId: chatMessagesTable.serverId,
            sessionGeneration: chatMessagesTable.sessionGeneration,
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
                isNull(chatsTable.deletedAt),
                input.chatId ? eq(chatMessagesTable.chatId, input.chatId) : undefined,
                input.authorAgentId
                    ? eq(chatMessagesTable.authorAgentId, input.authorAgentId)
                    : undefined,
                input.authorUserId
                    ? eq(chatMessagesTable.authorUserId, input.authorUserId)
                    : undefined,
                input.after ? gte(chatMessagesTable.createdAt, new Date(input.after)) : undefined,
                sql`${chatMessagesTable.searchVector}
                    @@ websearch_to_tsquery('simple', ${input.query})`,
                visibleChats(member.id)
            )
        )
        .orderBy(sql`${chatMessagesTable.createdAt} desc`, sql`${chatMessagesTable.id} desc`)
        .limit(input.limit);

    const messageIds = rows.map((message) => message.id);
    const [attachments, actions, causes, bodies] = await Promise.all([
        readMessageAttachments(db, input.serverId, messageIds),
        readPreparedActionsForMessages(db, input.serverId, messageIds),
        readMessageCauses(db, input.serverId, messageIds),
        readMessageBodies(db, input.serverId, messageIds),
    ]);

    return rows.map((message) => ({
        ...toChatMessage(message, {
            attachments: attachments.get(message.id) ?? [],
            authorProfile: readStoredAuthorProfile(message),
            body: bodies.get(message.id),
            cause: causes.get(message.id),
            preparedAction: actions.get(message.id),
        }),
        chatArchivedAt: message.chatArchivedAt?.toISOString() ?? null,
    }));
}
