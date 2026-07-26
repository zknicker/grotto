import type { HostedChatMessage } from '@tavern/api';

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

export function toHostedChatMessage(message: StoredChatMessage): HostedChatMessage {
    return {
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
