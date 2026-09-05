import type { ChatMessage, OpenAsk } from '@grotto/api';
import { and, asc, eq, getTableColumns } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { visibleChats } from '../chats/chat-visibility.ts';
import { readStoredAuthorProfile, toChatMessage } from '../chats/message-shape.ts';
import { readMessagesById } from '../chats/read-messages-by-id.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable, asksTable, chatMessagesTable, chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { toAsk } from './ask-shape.ts';

const parentChatsTable = alias(chatsTable, 'parent_chat');
const answerThreadsTable = alias(chatsTable, 'answer_thread');

interface ConversationChat {
    chatId: string | null;
    dmMemberOneUserId: string | null;
    dmMemberTwoUserId: string | null;
    kind: 'channel' | 'dm' | 'thread' | null;
    name: string | null;
}

/**
 * Every open Ask addressed to the viewer, oldest first. Ordinary Server
 * authorization: Server membership plus Chat access on the Ask's own Chat,
 * which for a Thread derives from its parent. Revoked access stops returning
 * the row rather than hiding a partial one.
 */
export async function listOpenAsks(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { serverId: string }
): Promise<OpenAsk[]> {
    await requireServerMembership(db, member, input.serverId);
    if (!member) {
        return [];
    }

    const rows = await db
        .select({
            ...getTableColumns(chatMessagesTable),
            answerThreadChatId: answerThreadsTable.id,
            ask: asksTable,
            askChatDmMemberOneUserId: chatsTable.dmMemberOneUserId,
            askChatDmMemberTwoUserId: chatsTable.dmMemberTwoUserId,
            askChatAnchorMessageId: chatsTable.anchorMessageId,
            askChatKind: chatsTable.kind,
            askChatName: chatsTable.name,
            authorAgentAvatarId: agentsTable.avatarId,
            authorAgentDescription: agentsTable.description,
            authorAgentDisplayName: agentsTable.displayName,
            authorAgentRetiredAt: agentsTable.retiredAt,
            parentChatDmMemberOneUserId: parentChatsTable.dmMemberOneUserId,
            parentChatDmMemberTwoUserId: parentChatsTable.dmMemberTwoUserId,
            parentChatId: parentChatsTable.id,
            parentChatKind: parentChatsTable.kind,
            parentChatName: parentChatsTable.name,
        })
        .from(asksTable)
        .innerJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, asksTable.serverId),
                eq(chatMessagesTable.id, asksTable.messageId)
            )
        )
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, asksTable.serverId),
                eq(chatsTable.id, asksTable.chatId),
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
            answerThreadsTable,
            and(
                eq(answerThreadsTable.serverId, asksTable.serverId),
                eq(answerThreadsTable.parentChatId, asksTable.chatId),
                eq(answerThreadsTable.anchorMessageId, asksTable.messageId)
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
                eq(asksTable.serverId, input.serverId),
                eq(asksTable.addresseeUserId, member.id),
                eq(asksTable.status, 'open')
            )
        )
        .orderBy(asc(asksTable.createdAt));

    // An Ask posted inside a Thread answers on that Thread's own anchor, which
    // is a Message this list has not read. One batched read keeps every row
    // able to open its conversation.
    const anchorMessages = await readMessagesById(
        db,
        input.serverId,
        rows.flatMap((row) =>
            row.askChatKind === 'thread' && row.askChatAnchorMessageId
                ? [row.askChatAnchorMessageId]
                : []
        )
    );

    return rows.map((row) => {
        const ask = toAsk(row.ask);
        const inThread = row.askChatKind === 'thread';
        // A top-level Ask owns its child Thread; an Ask inside a Thread answers
        // in that Thread. Either way the answer surface already exists.
        const threadChatId = inThread ? ask.chatId : row.answerThreadChatId;
        const conversation: ConversationChat = inThread
            ? {
                  chatId: row.parentChatId,
                  dmMemberOneUserId: row.parentChatDmMemberOneUserId,
                  dmMemberTwoUserId: row.parentChatDmMemberTwoUserId,
                  kind: row.parentChatKind,
                  name: row.parentChatName,
              }
            : {
                  chatId: ask.chatId,
                  dmMemberOneUserId: row.askChatDmMemberOneUserId,
                  dmMemberTwoUserId: row.askChatDmMemberTwoUserId,
                  kind: row.askChatKind,
                  name: row.askChatName,
              };
        const threadAnchorMessage = readThreadAnchor(row, anchorMessages);
        if (!threadChatId) {
            throw new Error(`Ask ${ask.id} has no answer Thread.`);
        }
        if (!conversation.chatId) {
            throw new Error(`Ask ${ask.id} has no conversation Chat.`);
        }
        if (conversation.kind !== 'channel' && conversation.kind !== 'dm') {
            throw new Error(`Ask ${ask.id} does not belong to a Channel or DM.`);
        }
        if (inThread && !threadAnchorMessage) {
            throw new Error(`Ask ${ask.id} has no readable Thread anchor.`);
        }
        return {
            ask,
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
                body: { ask, kind: 'ask' },
            }),
            threadAnchorMessage,
            threadChatId,
        };
    });
}

function readThreadAnchor(
    row: { askChatAnchorMessageId: string | null; askChatKind: string | null },
    anchors: ReadonlyMap<string, ChatMessage>
): ChatMessage | null {
    if (row.askChatKind !== 'thread' || !row.askChatAnchorMessageId) {
        return null;
    }
    return anchors.get(row.askChatAnchorMessageId) ?? null;
}

function readPeerUserId(chat: ConversationChat, viewerUserId: string) {
    if (chat.kind !== 'dm') {
        return null;
    }
    return chat.dmMemberOneUserId === viewerUserId
        ? chat.dmMemberTwoUserId
        : chat.dmMemberOneUserId;
}
