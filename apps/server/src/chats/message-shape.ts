import type { HostedChatMessage } from '@tavern/api';

interface StoredChatMessage {
    authorUserId: string | null;
    chatId: string;
    content: string;
    createdAt: Date;
    id: string;
    nonce: string;
    sequence: number;
    serverId: string;
    systemAuthor: 'reminder' | null;
}

export function toHostedChatMessage(message: StoredChatMessage): HostedChatMessage {
    return {
        author:
            message.systemAuthor === 'reminder'
                ? { kind: 'system', system: 'reminder' }
                : { kind: 'human', userId: requireHumanAuthor(message.authorUserId) },
        chatId: message.chatId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        id: message.id,
        nonce: message.nonce,
        sequence: message.sequence,
        serverId: message.serverId,
    };
}

function requireHumanAuthor(authorUserId: string | null) {
    if (authorUserId === null) {
        throw new Error('A hosted Chat message must have an explicit author.');
    }
    return authorUserId;
}
