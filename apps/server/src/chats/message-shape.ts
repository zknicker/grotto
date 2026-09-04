import type {
    AttachmentMetadata,
    ChatMessage,
    MessageBody,
    MessageBodyKind,
    MessageCause,
    PreparedAction,
} from '@grotto/api';
import { avatarUrlFor } from '../avatars/avatar-url.ts';

interface StoredChatMessage {
    authorAgentId: string | null;
    authorUserId: string | null;
    bodyKind: MessageBodyKind;
    chatId: string;
    content: string;
    createdAt: Date;
    id: string;
    nonce: string;
    runId: string | null;
    sequence: number;
    serverId: string;
    sessionGeneration: number | null;
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

/** Everything the one Message reader joins onto a stored Message row. */
export interface StoredChatMessageRelations {
    attachments?: AttachmentMetadata[];
    authorProfile?: StoredChatMessageAuthorProfile;
    /** The typed body projected from its Server record; text needs none. */
    body?: MessageBody;
    /** Why an Agent wrote this: the Trigger or Reminder fire it answered. */
    cause?: MessageCause;
    preparedAction?: PreparedAction;
}

export function toChatMessage(
    message: StoredChatMessage,
    related: StoredChatMessageRelations = {}
): ChatMessage {
    const { attachments = [], authorProfile, body, cause, preparedAction } = related;
    return {
        attachments,
        author: readAuthor(message, authorProfile),
        body: readBody(message, body),
        ...(cause ? { cause } : {}),
        chatId: message.chatId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        id: message.id,
        nonce: message.nonce,
        runId: message.runId,
        sequence: message.sequence,
        serverId: message.serverId,
        sessionGeneration: message.sessionGeneration,
        ...(preparedAction ? { preparedAction } : {}),
    };
}

/**
 * A stored body kind and its projected record must agree. A missing record is a
 * failed mapping, never a Message silently downgraded to text.
 */
function readBody(message: StoredChatMessage, body: MessageBody | undefined): MessageBody {
    if (message.bodyKind === 'text') {
        return { kind: 'text' };
    }
    if (body?.kind !== message.bodyKind) {
        throw new Error(`Message ${message.id} has no ${message.bodyKind} record to project.`);
    }
    return body;
}

function readAuthor(
    message: StoredChatMessage,
    profile?: StoredChatMessageAuthorProfile
): ChatMessage['author'] {
    if (message.authorAgentId !== null) {
        return { agentId: message.authorAgentId, kind: 'agent', profile };
    }
    if (message.authorUserId === null) {
        throw new Error('A Chat message must have an explicit author.');
    }
    return { kind: 'human', profile, userId: message.authorUserId };
}
