import type { HostedAttachmentMetadata, HostedChatMessage } from '@tavern/api';

interface StoredChatMessage {
    authorUserId: string;
    chatId: string;
    content: string;
    createdAt: Date;
    id: string;
    nonce: string;
    sequence: number;
    serverId: string;
}

export function toHostedChatMessage(
    message: StoredChatMessage,
    attachments: HostedAttachmentMetadata[] = []
): HostedChatMessage {
    return {
        attachments,
        authorUserId: message.authorUserId,
        chatId: message.chatId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        id: message.id,
        nonce: message.nonce,
        sequence: message.sequence,
        serverId: message.serverId,
    };
}
