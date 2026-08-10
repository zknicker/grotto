import { hostedIdSchema } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import { requireChatWriteAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatMessagesTable, chatsTable, threadFollowsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

type ThreadWriter = Pick<GrottoDatabase, 'insert' | 'select'>;

export class InvalidThreadAnchorError extends Error {
    constructor() {
        super('The Thread anchor must be a message in its parent Chat.');
        this.name = 'InvalidThreadAnchorError';
    }
}

export class NestedThreadError extends Error {
    constructor() {
        super('Threads cannot contain child Threads.');
        this.name = 'NestedThreadError';
    }
}

export async function ensureHostedThread(
    db: ThreadWriter,
    member: GrottoUser | null,
    input: { anchorMessageId: string; parentChatId: string; serverId: string }
) {
    await requireChatWriteAccess(db, member, {
        chatId: input.parentChatId,
        serverId: input.serverId,
    });
    const thread = await ensureHostedThreadRecord(db, input);

    const [anchor] = await db
        .select({ authorUserId: chatMessagesTable.authorUserId })
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, input.serverId),
                eq(chatMessagesTable.chatId, input.parentChatId),
                eq(chatMessagesTable.id, input.anchorMessageId)
            )
        )
        .limit(1);
    if (anchor?.authorUserId) {
        await db
            .insert(threadFollowsTable)
            .values({
                serverId: input.serverId,
                threadChatId: thread.id,
                userId: anchor.authorUserId,
            })
            .onConflictDoNothing();
    }
    return thread;
}

/** Creates the canonical thread row after the caller has proved parent authority. */
export async function ensureHostedThreadRecord(
    db: ThreadWriter,
    input: { anchorMessageId: string; parentChatId: string; serverId: string }
) {
    const [parent] = await db
        .select({ kind: chatsTable.kind })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.parentChatId)))
        .limit(1);
    if (!parent) {
        throw new InvalidThreadAnchorError();
    }
    if (parent.kind === 'thread') {
        throw new NestedThreadError();
    }

    const [anchor] = await db
        .select({
            id: chatMessagesTable.id,
        })
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, input.serverId),
                eq(chatMessagesTable.chatId, input.parentChatId),
                eq(chatMessagesTable.id, input.anchorMessageId)
            )
        )
        .limit(1);

    if (!anchor) {
        throw new InvalidThreadAnchorError();
    }

    const threadChatId = hostedIdSchema.parse(
        `cht_thr_${stripMessagePrefix(input.anchorMessageId)}`
    );

    await db
        .insert(chatsTable)
        .values({
            anchorMessageId: input.anchorMessageId,
            id: threadChatId,
            kind: 'thread',
            parentChatId: input.parentChatId,
            parentChatKind: parent.kind,
            serverId: input.serverId,
        })
        .onConflictDoNothing();

    const [thread] = await db
        .select({
            anchorMessageId: chatsTable.anchorMessageId,
            id: chatsTable.id,
            kind: chatsTable.kind,
            parentChatId: chatsTable.parentChatId,
        })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, threadChatId)))
        .limit(1);

    if (
        thread?.kind !== 'thread' ||
        thread.parentChatId !== input.parentChatId ||
        thread.anchorMessageId !== input.anchorMessageId
    ) {
        throw new InvalidThreadAnchorError();
    }

    return { id: threadChatId, parentChatId: input.parentChatId };
}

function stripMessagePrefix(messageId: string) {
    return messageId.startsWith('msg_') ? messageId.slice(4) : messageId;
}
