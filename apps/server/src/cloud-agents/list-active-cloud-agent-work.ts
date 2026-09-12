import type { ActiveCloudAgentWork, ChatMessage } from '@haus/api';
import { and, asc, eq, getTableColumns, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { visibleChats } from '../chats/chat-visibility.ts';
import { readChatMessageReactions } from '../chats/message-reactions.ts';
import { readStoredAuthorProfile, toChatMessage } from '../chats/message-shape.ts';
import { readMessagesById } from '../chats/read-messages-by-id.ts';
import type { HausDatabase } from '../postgres/connection.ts';
import {
    agentsTable,
    chatMessagesTable,
    chatsTable,
    cloudAgentWorkTable,
} from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { HausUser } from '../users/haus-user.ts';
import { readRuns, toCloudAgentWork } from './cloud-agent-shape.ts';

const parentChatsTable = alias(chatsTable, 'parent_chat');
const workThreadsTable = alias(chatsTable, 'work_thread');

interface ConversationChat {
    chatId: string | null;
    dmMemberOneUserId: string | null;
    dmMemberTwoUserId: string | null;
    kind: 'channel' | 'dm' | 'thread' | null;
    name: string | null;
}

/**
 * Every queued or running Cloud Agent work the viewer can see, oldest first.
 * Ordinary Server authorization: Server membership plus Chat access on the
 * work's own Chat, which for a Thread derives from its parent. Losing access
 * stops returning the row rather than hiding a partial one.
 */
export async function listActiveCloudAgentWork(
    db: HausDatabase,
    member: HausUser | null,
    input: { serverId: string }
): Promise<ActiveCloudAgentWork[]> {
    await requireServerMembership(db, member, input.serverId);
    if (!member) {
        return [];
    }

    const rows = await db
        .select({
            ...getTableColumns(chatMessagesTable),
            authorAgentAvatarId: agentsTable.avatarId,
            authorAgentDescription: agentsTable.description,
            authorAgentDisplayName: agentsTable.displayName,
            authorAgentRetiredAt: agentsTable.retiredAt,
            parentChatDmMemberOneUserId: parentChatsTable.dmMemberOneUserId,
            parentChatDmMemberTwoUserId: parentChatsTable.dmMemberTwoUserId,
            parentChatId: parentChatsTable.id,
            parentChatKind: parentChatsTable.kind,
            parentChatName: parentChatsTable.name,
            work: cloudAgentWorkTable,
            workChatAnchorMessageId: chatsTable.anchorMessageId,
            workChatDmMemberOneUserId: chatsTable.dmMemberOneUserId,
            workChatDmMemberTwoUserId: chatsTable.dmMemberTwoUserId,
            workChatKind: chatsTable.kind,
            workChatName: chatsTable.name,
            workThreadChatId: workThreadsTable.id,
        })
        .from(cloudAgentWorkTable)
        .innerJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, cloudAgentWorkTable.serverId),
                eq(chatMessagesTable.id, cloudAgentWorkTable.messageId)
            )
        )
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, cloudAgentWorkTable.serverId),
                eq(chatsTable.id, cloudAgentWorkTable.chatId),
                visibleChats(member.id)
            )
        )
        .leftJoin(
            parentChatsTable,
            and(
                eq(parentChatsTable.serverId, chatsTable.serverId),
                eq(parentChatsTable.id, chatsTable.parentChatId)
            )
        )
        .leftJoin(
            workThreadsTable,
            and(
                eq(workThreadsTable.serverId, cloudAgentWorkTable.serverId),
                eq(workThreadsTable.parentChatId, cloudAgentWorkTable.chatId),
                eq(workThreadsTable.anchorMessageId, cloudAgentWorkTable.messageId)
            )
        )
        .leftJoin(
            agentsTable,
            and(
                eq(agentsTable.serverId, chatMessagesTable.serverId),
                eq(agentsTable.id, chatMessagesTable.authorAgentId)
            )
        )
        .where(
            and(
                eq(cloudAgentWorkTable.serverId, input.serverId),
                inArray(cloudAgentWorkTable.status, ['queued', 'running'])
            )
        )
        .orderBy(asc(cloudAgentWorkTable.createdAt));

    const [runs, reactions] = await Promise.all([
        readRuns(
            db,
            input.serverId,
            rows.map((row) => row.work.id)
        ),
        readChatMessageReactions(
            db,
            input.serverId,
            rows.map((row) => row.id)
        ),
    ]);
    // Work posted inside a Thread opens on that Thread's own anchor, which this
    // list has not read. One batched read keeps every row able to open it.
    const anchorMessages = await readMessagesById(
        db,
        input.serverId,
        rows.flatMap((row) =>
            row.workChatKind === 'thread' && row.workChatAnchorMessageId
                ? [row.workChatAnchorMessageId]
                : []
        )
    );

    return rows.map((row) => {
        const work = toCloudAgentWork(row.work, runs.get(row.work.id) ?? []);
        const inThread = row.workChatKind === 'thread';
        const threadChatId = inThread ? work.chatId : row.workThreadChatId;
        const conversation: ConversationChat = inThread
            ? {
                  chatId: row.parentChatId,
                  dmMemberOneUserId: row.parentChatDmMemberOneUserId,
                  dmMemberTwoUserId: row.parentChatDmMemberTwoUserId,
                  kind: row.parentChatKind,
                  name: row.parentChatName,
              }
            : {
                  chatId: work.chatId,
                  dmMemberOneUserId: row.workChatDmMemberOneUserId,
                  dmMemberTwoUserId: row.workChatDmMemberTwoUserId,
                  kind: row.workChatKind,
                  name: row.workChatName,
              };
        const threadAnchorMessage = readThreadAnchor(row, anchorMessages);
        if (!threadChatId) {
            throw new Error(`Cloud Agent work ${work.id} has no Thread.`);
        }
        if (!conversation.chatId) {
            throw new Error(`Cloud Agent work ${work.id} has no conversation Chat.`);
        }
        if (conversation.kind !== 'channel' && conversation.kind !== 'dm') {
            throw new Error(`Cloud Agent work ${work.id} does not belong to a Channel or DM.`);
        }
        if (inThread && !threadAnchorMessage) {
            throw new Error(`Cloud Agent work ${work.id} has no readable Thread anchor.`);
        }
        return {
            chatKind: conversation.kind,
            chatName: conversation.name,
            chatPeerUserId: readPeerUserId(conversation, member.id),
            conversationChatId: conversation.chatId,
            message: toChatMessage(row, {
                authorProfile: readStoredAuthorProfile({
                    ...row,
                    authorUserAvatarId: null,
                    authorUserDescription: null,
                    authorUserDisplayName: null,
                    authorUserRevokedAt: null,
                }),
                body: { kind: 'cloud-agent-work', work },
                reactions: reactions.get(row.id),
            }),
            threadAnchorMessage,
            threadChatId,
            work,
        };
    });
}

function readThreadAnchor(
    row: { workChatAnchorMessageId: string | null; workChatKind: string | null },
    anchors: ReadonlyMap<string, ChatMessage>
): ChatMessage | null {
    if (row.workChatKind !== 'thread' || !row.workChatAnchorMessageId) {
        return null;
    }
    return anchors.get(row.workChatAnchorMessageId) ?? null;
}

function readPeerUserId(chat: ConversationChat, viewerUserId: string) {
    if (chat.kind !== 'dm') {
        return null;
    }
    return chat.dmMemberOneUserId === viewerUserId
        ? chat.dmMemberTwoUserId
        : chat.dmMemberOneUserId;
}
