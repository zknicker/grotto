interface ChatDisplayParticipant {
    actorType: 'agent' | 'participant';
    name: string;
}

export interface ChatDisplayInput {
    conversationKind: 'channel' | 'direct' | 'group' | 'task' | 'topic';
    displayName: string;
    participants: ChatDisplayParticipant[];
    scope: 'channel' | 'dm' | 'group' | 'task' | 'topic' | null;
    targetParticipant: {
        name: string;
    } | null;
    title: string;
    type: string;
}

export function getChatDisplayTitle(chat: ChatDisplayInput) {
    if (isRuntimeDm(chat)) {
        const agentLabel = formatParticipantNames(
            chat.participants
                .filter((participant) => participant.actorType === 'agent')
                .map((participant) => participant.name)
        );
        const targetLabel = (chat.targetParticipant?.name ?? chat.displayName.trim()) || chat.title;
        return agentLabel ? `${agentLabel} <-> ${targetLabel}` : targetLabel;
    }

    if (chat.type === 'grotto') {
        return resolveGrottoChatName(chat);
    }

    return chat.title;
}

export function isRuntimeDm(chat: ChatDisplayInput) {
    return chat.type !== 'grotto' && chat.scope === 'dm';
}

function formatParticipantNames(names: string[]) {
    if (names.length === 0) {
        return null;
    }

    if (names.length === 1) {
        return names[0] ?? null;
    }

    if (names.length === 2) {
        return `${names[0]} and ${names[1]}`;
    }

    return names.join(', ');
}

export function formatChatPlatformLabel(type: string) {
    if (type === 'discord') {
        return 'Discord';
    }

    return type
        .split(/[-_\s]+/u)
        .filter(Boolean)
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(' ');
}

export function resolveGrottoChatName(chat: ChatDisplayInput) {
    return chat.displayName.trim() || chat.title;
}
