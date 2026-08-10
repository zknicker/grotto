import type { HostedChatMessage } from '@tavern/api';
import { and, desc, eq, getTableColumns, lt } from 'drizzle-orm';
import { readMessageAttachments } from '../attachments/message-attachments.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentsTable,
    chatMessagesTable,
    serverMembershipsTable,
    usersTable,
} from '../postgres/schema.ts';
import { listHostedMessageTaskMap } from '../tasks/task-shape.ts';
import { listHostedThreadSummaries } from '../threads/list-thread-summaries.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireChatAccess } from './chat-access.ts';
import { readStoredAuthorProfile, toHostedChatMessage } from './message-shape.ts';

export async function listHostedChatMessages(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: {
        beforeSequence?: number;
        chatId: string;
        limit: number;
        serverId: string;
    }
): Promise<{
    messages: HostedChatMessage[];
    nextBeforeSequence: number | null;
    threads: Awaited<ReturnType<typeof listHostedThreadSummaries>>;
}> {
    await requireChatAccess(db, member, input);

    const predicates = [
        eq(chatMessagesTable.serverId, input.serverId),
        eq(chatMessagesTable.chatId, input.chatId),
    ];

    if (input.beforeSequence !== undefined) {
        predicates.push(lt(chatMessagesTable.sequence, input.beforeSequence));
    }

    const newestFirst = await db
        .select({
            ...getTableColumns(chatMessagesTable),
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
        .where(and(...predicates))
        .orderBy(desc(chatMessagesTable.sequence))
        .limit(input.limit + 1);
    const hasOlderMessages = newestFirst.length > input.limit;
    const messageRows = newestFirst.slice(0, input.limit).reverse();
    const messageIds = messageRows.map((message) => message.id);
    const [attachmentsByMessageId, taskByMessageId] = await Promise.all([
        readMessageAttachments(db, input.serverId, messageIds),
        listHostedMessageTaskMap(db, input.serverId, messageIds),
    ]);
    const messages = messageRows.map((message) => ({
        ...toHostedChatMessage(
            message,
            attachmentsByMessageId.get(message.id) ?? [],
            readStoredAuthorProfile(message)
        ),
        task: taskByMessageId.get(message.id) ?? null,
    }));

    return {
        messages,
        nextBeforeSequence: hasOlderMessages ? (messages[0]?.sequence ?? null) : null,
        threads: await listHostedThreadSummaries(db, member, {
            anchorMessageIds: messages.map((message) => message.id),
            parentChatId: input.chatId,
            serverId: input.serverId,
        }),
    };
}
