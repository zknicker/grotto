import type { HostedAttachmentMetadata, HostedChatMessage } from '@tavern/api';

interface StoredChatMessage {
    authorAgentId: string | null;
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

export function toHostedChatMessage(
    message: StoredChatMessage,
    attachments: HostedAttachmentMetadata[] = []
): HostedChatMessage {
    return {
        attachments,
        author: readAuthor(message),
        chatId: message.chatId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        id: message.id,
        nonce: message.nonce,
        sequence: message.sequence,
        serverId: message.serverId,
    };
}

function readAuthor(message: StoredChatMessage): HostedChatMessage['author'] {
    if (message.systemAuthor === 'reminder') {
        return { kind: 'system', system: 'reminder' };
    }
    if (message.authorAgentId !== null) {
        return { agentId: message.authorAgentId, kind: 'agent' };
    }
    if (message.authorUserId === null) {
        throw new Error('A hosted Chat message must have an explicit author.');
    }
    return { kind: 'human', userId: message.authorUserId };
}
