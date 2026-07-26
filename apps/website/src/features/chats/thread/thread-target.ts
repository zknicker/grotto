import {
    getChatDisplayTitle,
    resolveTavernChatName,
} from '../../../components/chats/chat-display.ts';

export interface ThreadTargetChat {
    conversationKind: 'channel' | 'direct' | 'group' | 'task' | 'topic';
    displayName: string;
    participants: Array<{
        actorId?: string;
        actorType: 'agent' | 'participant';
        name: string;
    }>;
    scope: 'channel' | 'dm' | 'group' | 'task' | 'topic' | null;
    targetParticipant: { name: string } | null;
    title: string;
    type: string;
}

const operatorActorIds = new Set(['usr_tavern', 'profile:self']);

export function threadPaneTitles(
    chat: ThreadTargetChat,
    anchorMessageId: string
): { header: string; target: null | string } {
    const shortId = threadAnchorShortId(anchorMessageId);

    if (chat.conversationKind === 'direct' || chat.scope === 'dm') {
        const peer = getDmPeerName(chat);
        return {
            header: `Thread — @${peer}`,
            target: `dm:@${peer}:${shortId}`,
        };
    }

    // Task chats are not addressable by the channel/DM target grammar; their
    // threads get no copyable target.
    if (chat.conversationKind === 'task' || chat.scope === 'task') {
        return {
            header: `Thread — ${resolveTavernChatName(chat) || chat.title}`,
            target: null,
        };
    }

    const displayName = getChannelName(chat);
    return {
        header: `Thread — #${displayName}`,
        target: `#${displayName}:${shortId}`,
    };
}

// The wire contract's short-id rule (specs/grotto-cli.md): only canonical
// msg_<32 hex> ids shorten to hex8; anything else keeps its full value so
// server-side resolution stays unambiguous.
export function threadAnchorShortId(anchorMessageId: string) {
    const match = /^msg_([A-Fa-f0-9]{32})$/u.exec(anchorMessageId);
    return match?.[1]?.slice(0, 8).toLowerCase() ?? anchorMessageId;
}

export function getChannelName(chat: ThreadTargetChat) {
    const title = chat.type === 'tavern' ? resolveTavernChatName(chat) : getChatDisplayTitle(chat);
    return title.replace(/^#/u, '');
}

export function getDmPeerName(chat: ThreadTargetChat) {
    const candidates = chat.participants.filter(
        (participant) => !operatorActorIds.has(participant.actorId ?? '')
    );
    return (
        candidates.find((participant) => participant.actorType === 'agent')?.name ??
        candidates[0]?.name ??
        chat.targetParticipant?.name ??
        getChatDisplayTitle(chat)
    ).replace(/^@/u, '');
}
