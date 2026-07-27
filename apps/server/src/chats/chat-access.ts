import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { visibleHostedChats } from './chat-visibility.ts';

type ChatReader = Pick<GrottoDatabase, 'select'>;

export class ChatNotFoundError extends Error {
    constructor() {
        super('No Chat exists in this Server with that id.');
        this.name = 'ChatNotFoundError';
    }
}

export class ChatAccessDeniedError extends Error {
    constructor() {
        super('You are not a participant in this Chat.');
        this.name = 'ChatAccessDeniedError';
    }
}

export interface AccessibleChat {
    dmMemberOneStint: number | null;
    dmMemberOneUserId: string | null;
    dmMemberTwoStint: number | null;
    dmMemberTwoUserId: string | null;
    id: string;
    kind: 'channel' | 'dm' | 'thread';
    lastMessageSequence: number;
    parentChatId: string | null;
    serverId: string;
}

export async function requireChatAccess(
    db: ChatReader,
    member: GrottoUser | null,
    input: { chatId: string; serverId: string }
): Promise<AccessibleChat> {
    await requireServerMembership(db, member, input.serverId);

    if (!member) {
        throw new ChatAccessDeniedError();
    }

    const accessibleChat = await findHostedChatAccess(db, member.id, input);

    if (accessibleChat) {
        return accessibleChat;
    }

    const [existingChat] = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .limit(1);

    if (!existingChat) {
        throw new ChatNotFoundError();
    }

    throw new ChatAccessDeniedError();
}

export async function findHostedChatAccess(
    db: ChatReader,
    userId: string,
    input: { chatId: string; serverId: string }
): Promise<AccessibleChat | null> {
    const [chat] = await db
        .select({
            dmMemberOneStint: chatsTable.dmMemberOneStint,
            dmMemberOneUserId: chatsTable.dmMemberOneUserId,
            dmMemberTwoStint: chatsTable.dmMemberTwoStint,
            dmMemberTwoUserId: chatsTable.dmMemberTwoUserId,
            id: chatsTable.id,
            kind: chatsTable.kind,
            lastMessageSequence: chatsTable.lastMessageSequence,
            parentChatId: chatsTable.parentChatId,
            serverId: chatsTable.serverId,
        })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, input.serverId),
                eq(chatsTable.id, input.chatId),
                visibleHostedChats(userId)
            )
        )
        .limit(1);

    return chat
        ? {
              dmMemberOneStint: chat.dmMemberOneStint,
              dmMemberOneUserId: chat.dmMemberOneUserId,
              dmMemberTwoStint: chat.dmMemberTwoStint,
              dmMemberTwoUserId: chat.dmMemberTwoUserId,
              id: chat.id,
              kind: chat.kind,
              lastMessageSequence: chat.lastMessageSequence,
              parentChatId: chat.parentChatId,
              serverId: chat.serverId,
          }
        : null;
}
