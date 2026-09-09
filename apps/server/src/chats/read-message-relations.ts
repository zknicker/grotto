import type { AttachmentMetadata, ChatMessage } from '@grotto/api';
import { readMessageAttachments } from '../attachments/message-attachments.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { readChatMessageReactions } from './message-reactions.ts';

export async function readMessageRelations(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageId: string
): Promise<{ attachments: AttachmentMetadata[]; reactions: ChatMessage['reactions'] | undefined }> {
    // The caller may hold a transaction connection, so keep these reads sequential.
    const attachments = await readMessageAttachments(db, serverId, [messageId]);
    const reactions = await readChatMessageReactions(db, serverId, [messageId]);
    return {
        attachments: attachments.get(messageId) ?? [],
        reactions: reactions.get(messageId),
    };
}
