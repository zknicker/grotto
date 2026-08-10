import { and, eq, inArray, isNotNull, or } from 'drizzle-orm';
import type { AttachmentRoot } from '../attachments/attachment-root.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { attachmentsTable, chatsTable, remindersTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';

interface DeletedChannelTarget {
    chatId: string;
    serverId: string;
}

export async function purgeDeletedHostedChannels(db: GrottoDatabase, root: AttachmentRoot) {
    const channels = await db
        .select({ chatId: chatsTable.id, serverId: chatsTable.serverId })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.kind, 'channel'),
                eq(chatsTable.isAll, false),
                isNotNull(chatsTable.deletedAt)
            )
        );
    for (const channel of channels) {
        await purgeDeletedHostedChannel(db, root, channel);
    }
}

export async function purgeDeletedHostedChannel(
    db: GrottoDatabase,
    root: AttachmentRoot,
    input: DeletedChannelTarget
) {
    const chats = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, input.serverId),
                or(eq(chatsTable.id, input.chatId), eq(chatsTable.parentChatId, input.chatId))
            )
        );
    const chatIds = chats.map(({ id }) => id);
    if (chatIds.length === 0) {
        return;
    }

    await root.discardAttachments(
        input.serverId,
        async () =>
            await db
                .select({
                    attachmentId: attachmentsTable.id,
                    stagingKey: attachmentsTable.stagingKey,
                })
                .from(attachmentsTable)
                .where(
                    and(
                        eq(attachmentsTable.serverId, input.serverId),
                        inArray(attachmentsTable.chatId, chatIds)
                    )
                )
    );

    await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const [deleted] = await tx
            .select({ id: chatsTable.id })
            .from(chatsTable)
            .where(
                and(
                    eq(chatsTable.serverId, input.serverId),
                    eq(chatsTable.id, input.chatId),
                    eq(chatsTable.kind, 'channel'),
                    isNotNull(chatsTable.deletedAt)
                )
            );
        if (!deleted) {
            return;
        }

        await tx
            .delete(remindersTable)
            .where(
                and(
                    eq(remindersTable.serverId, input.serverId),
                    inArray(remindersTable.anchorChatId, chatIds)
                )
            );
        const childIds = chatIds.filter((id) => id !== input.chatId);
        if (childIds.length > 0) {
            await tx.delete(chatsTable).where(inArray(chatsTable.id, childIds));
        }
        await tx
            .delete(chatsTable)
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)));
    });
}
