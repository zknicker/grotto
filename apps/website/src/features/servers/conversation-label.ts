import type { HumanDirectory } from './human-identity.ts';

/** The Channel or DM facts every Inbox row names its conversation from. */
export interface ConversationIdentity {
    chatKind: 'channel' | 'dm';
    chatName: null | string;
    chatPeerUserId: null | string;
}

/**
 * Where a record was posted. A DM with an Agent has no human peer to name, and
 * the Agent is already stated beside this label, so it reads as `DM` rather
 * than repeating a name or claiming a peer that is not there.
 */
export function conversationLabel(
    conversation: ConversationIdentity,
    humans: HumanDirectory
): string {
    if (conversation.chatKind === 'channel') {
        return `#${conversation.chatName ?? 'channel'}`;
    }
    return conversation.chatPeerUserId ? `DM · ${humans.name(conversation.chatPeerUserId)}` : 'DM';
}
