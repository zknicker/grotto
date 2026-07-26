import type { HostedChatReadReceipt, HostedDurableEvent } from '@tavern/api';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, chatReadsTable, chatsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { allocateHostedEventCursor } from './allocate-event-cursor.ts';
import { requireChatAccess } from './chat-access.ts';

export interface MarkHostedChatReadResult {
    event: HostedDurableEvent | null;
    receipt: HostedChatReadReceipt;
}

export async function markHostedChatRead(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { chatId: string; sequence: number; serverId: string }
): Promise<MarkHostedChatReadResult> {
    return await db.transaction(async (tx) => {
        await requireChatAccess(tx, member, input);

        if (!member) {
            throw new Error('A Server member is required to mark a Chat read.');
        }

        const [chat] = await tx
            .select({ lastMessageSequence: chatsTable.lastMessageSequence })
            .from(chatsTable)
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
            .limit(1);

        if (!chat) {
            throw new Error('Failed to lock the Chat read state.');
        }

        const sequence = Math.min(input.sequence, chat.lastMessageSequence);
        const [existing] = await tx
            .select({ sequence: chatReadsTable.sequence })
            .from(chatReadsTable)
            .where(
                and(
                    eq(chatReadsTable.serverId, input.serverId),
                    eq(chatReadsTable.chatId, input.chatId),
                    eq(chatReadsTable.readerUserId, member.id)
                )
            )
            .limit(1);

        if (existing && existing.sequence >= sequence) {
            return {
                event: null,
                receipt: {
                    chatId: input.chatId,
                    eventCursor: null,
                    sequence: existing.sequence,
                    serverId: input.serverId,
                },
            };
        }

        const [writtenRead] = await tx
            .insert(chatReadsTable)
            .values({
                chatId: input.chatId,
                readerUserId: member.id,
                sequence,
                serverId: input.serverId,
            })
            .onConflictDoUpdate({
                set: { sequence, updatedAt: sql`now()` },
                target: [
                    chatReadsTable.serverId,
                    chatReadsTable.chatId,
                    chatReadsTable.readerUserId,
                ],
                where: lt(chatReadsTable.sequence, sequence),
            })
            .returning({ sequence: chatReadsTable.sequence });

        if (!writtenRead) {
            const [currentRead] = await tx
                .select({ sequence: chatReadsTable.sequence })
                .from(chatReadsTable)
                .where(
                    and(
                        eq(chatReadsTable.serverId, input.serverId),
                        eq(chatReadsTable.chatId, input.chatId),
                        eq(chatReadsTable.readerUserId, member.id)
                    )
                )
                .limit(1);

            if (!currentRead) {
                throw new Error('Failed to resolve the concurrent Chat read state.');
            }

            return {
                event: null,
                receipt: {
                    chatId: input.chatId,
                    eventCursor: null,
                    sequence: currentRead.sequence,
                    serverId: input.serverId,
                },
            };
        }

        const eventCursor = await allocateHostedEventCursor(tx, input.serverId);
        const [event] = await tx
            .insert(chatEventsTable)
            .values({
                chatId: input.chatId,
                cursor: eventCursor,
                id: createOpaqueId('evt'),
                readerUserId: member.id,
                sequence,
                serverId: input.serverId,
                type: 'chat.read',
            })
            .returning({
                createdAt: chatEventsTable.createdAt,
                cursor: chatEventsTable.cursor,
                id: chatEventsTable.id,
            });

        if (!event) {
            throw new Error('Failed to record the Chat read event.');
        }

        return {
            event: {
                chatId: input.chatId,
                createdAt: event.createdAt.toISOString(),
                cursor: event.cursor.toString(),
                id: event.id,
                sequence,
                serverId: input.serverId,
                type: 'chat.read',
            },
            receipt: {
                chatId: input.chatId,
                eventCursor: event.cursor.toString(),
                sequence,
                serverId: input.serverId,
            },
        };
    });
}
