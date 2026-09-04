import type { AskAnsweredBy, ServerDurableEvent } from '@grotto/api';
import { and, desc, eq, lt, ne, or, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { asksTable, chatMessagesTable, chatsTable } from '../postgres/schema.ts';
import { insertAskEvent } from './ask-events.ts';

export interface AskReply {
    /** The Thread's anchor Message, whose own Ask a reply also answers. */
    anchorMessageId: string | null;
    answeredBy: AskAnsweredBy;
    answerMessageId: string;
    replySequence: number;
    serverId: string;
    threadChatId: string;
}

/**
 * A reply in a Thread settles the open Ask it answers, in the same transaction
 * as that reply: the Ask this Thread hangs off, or the newest open Ask posted
 * earlier inside the Thread. The asking Agent's own reply never settles its
 * Ask, and a later reply finds nothing open to change — first answer wins.
 * This is the only path that writes an Ask answer.
 */
export async function settleAskForReply(
    db: GrottoDatabase,
    input: AskReply
): Promise<ServerDurableEvent | null> {
    const [candidate] = await db
        .select({
            askChatId: asksTable.chatId,
            askId: asksTable.id,
            askMessageId: asksTable.messageId,
            chatKind: chatsTable.kind,
            parentChatId: chatsTable.parentChatId,
            sequence: chatMessagesTable.sequence,
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
            and(eq(chatsTable.serverId, asksTable.serverId), eq(chatsTable.id, asksTable.chatId))
        )
        .where(
            and(
                eq(asksTable.serverId, input.serverId),
                eq(asksTable.status, 'open'),
                or(
                    input.anchorMessageId
                        ? eq(asksTable.messageId, input.anchorMessageId)
                        : undefined,
                    and(
                        eq(asksTable.chatId, input.threadChatId),
                        lt(chatMessagesTable.sequence, input.replySequence)
                    )
                ),
                input.answeredBy.kind === 'agent'
                    ? ne(asksTable.agentId, input.answeredBy.id)
                    : undefined
            )
        )
        // An Ask inside this Thread is closer to the reply than the Ask the
        // Thread hangs off, so it is the one this reply answers.
        .orderBy(
            sql`(${asksTable.chatId} = ${input.threadChatId}) desc`,
            desc(chatMessagesTable.sequence)
        )
        .limit(1);
    if (!candidate) {
        return null;
    }

    const [settled] = await db
        .update(asksTable)
        .set({
            answerMessageId: input.answerMessageId,
            answeredAt: sql`now()`,
            answeredByAgentId: input.answeredBy.kind === 'agent' ? input.answeredBy.id : null,
            answeredByUserId: input.answeredBy.kind === 'user' ? input.answeredBy.id : null,
            status: 'answered',
        })
        .where(
            and(
                eq(asksTable.serverId, input.serverId),
                eq(asksTable.id, candidate.askId),
                eq(asksTable.status, 'open')
            )
        )
        .returning({ id: asksTable.id });
    if (!settled) {
        return null;
    }

    return await insertAskEvent(db, {
        askId: candidate.askId,
        chat: { kind: candidate.chatKind, parentChatId: candidate.parentChatId },
        chatId: candidate.askChatId,
        messageId: candidate.askMessageId,
        sequence: candidate.sequence,
        serverId: input.serverId,
    });
}
