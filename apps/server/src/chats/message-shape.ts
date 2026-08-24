import type { AttachmentMetadata, ChatMessage } from '@grotto/api';
import { avatarUrlFor } from '../avatars/avatar-url.ts';

interface StoredChatMessage {
    authorAgentId: string | null;
    authorUserId: string | null;
    chatId: string;
    content: string;
    createdAt: Date;
    id: string;
    nonce: string;
    runId: string | null;
    sequence: number;
    serverId: string;
    systemAuthor: 'reminder' | 'session' | 'task' | null;
}

export interface StoredChatMessageAuthorProfile {
    avatarUrl: string | null;
    deleted: boolean;
    description: string | null;
    displayName: string;
}

export interface StoredChatMessageAuthorProfileRow {
    authorAgentAvatarId: string | null;
    authorAgentDescription: string | null;
    authorAgentDisplayName: string | null;
    authorAgentId: string | null;
    authorAgentRetiredAt: Date | null;
    authorUserAvatarId: string | null;
    authorUserDescription: string | null;
    authorUserDisplayName: string | null;
    authorUserId: string | null;
    authorUserRevokedAt: Date | null;
}

export function readStoredAuthorProfile(
    message: StoredChatMessageAuthorProfileRow
): StoredChatMessageAuthorProfile | undefined {
    if (message.authorAgentId && message.authorAgentDisplayName) {
        return {
            avatarUrl: avatarUrlFor(message.authorAgentAvatarId),
            deleted: message.authorAgentRetiredAt !== null,
            description: message.authorAgentDescription,
            displayName: message.authorAgentDisplayName,
        };
    }
    if (message.authorUserId) {
        return {
            avatarUrl: avatarUrlFor(message.authorUserAvatarId),
            deleted: message.authorUserRevokedAt !== null,
            description: message.authorUserDescription,
            displayName: message.authorUserDisplayName ?? `Human ${message.authorUserId.slice(-6)}`,
        };
    }
    return undefined;
}

export function toChatMessage(
    message: StoredChatMessage,
    attachments: AttachmentMetadata[] = [],
    authorProfile?: StoredChatMessageAuthorProfile
): ChatMessage {
    return {
        attachments,
        author: readAuthor(message, authorProfile),
        chatId: message.chatId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        id: message.id,
        nonce: message.nonce,
        runId: message.runId,
        sequence: message.sequence,
        serverId: message.serverId,
    };
}

function readAuthor(
    message: StoredChatMessage,
    profile?: StoredChatMessageAuthorProfile
): ChatMessage['author'] {
    if (message.systemAuthor === 'reminder') {
        return { kind: 'system', system: 'reminder' };
    }
    if (message.systemAuthor === 'session') {
        return { kind: 'system', system: 'session' };
    }
    if (message.systemAuthor === 'task') {
        return { kind: 'system', system: 'task' };
    }
    if (message.authorAgentId !== null) {
        return { agentId: message.authorAgentId, kind: 'agent', profile };
    }
    if (message.authorUserId === null) {
        throw new Error('A Chat message must have an explicit author.');
    }
    return { kind: 'human', profile, userId: message.authorUserId };
}
