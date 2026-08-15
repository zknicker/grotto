import type { Agent, Chat, ChatMessage } from '@tavern/api';
import type { AgentSummary, ChatSummary } from './types.ts';

export function toAgentSummary(agent: Agent): AgentSummary {
    return {
        availability: agent.availability,
        avatarUrl: agent.avatarUrl,
        displayName: agent.displayName,
        id: agent.id,
        kind: 'agent',
    };
}

export function toChatSummary(chat: Chat): ChatSummary | null {
    if (chat.kind === 'channel') {
        return {
            id: chat.id,
            kind: 'channel',
            name: chat.name ?? (chat.isAll ? 'all' : 'Channel'),
            unread: chat.unreadCount,
        };
    }

    return chat.peerAgentId
        ? {
              id: chat.id,
              kind: 'dm',
              peerAgentId: chat.peerAgentId,
              unread: chat.unreadCount,
          }
        : null;
}

export function getChatTitle(chat: ChatSummary | undefined, agents: AgentSummary[]): string {
    if (!chat) {
        return 'Grotto';
    }
    if (chat.kind === 'channel') {
        return chat.name;
    }
    return agents.find((agent) => agent.id === chat.peerAgentId)?.displayName ?? 'Direct message';
}

export function isVisibleTimelineMessage(message: ChatMessage): boolean {
    if (message.author.kind !== 'system') {
        return true;
    }

    // Older Servers emitted a second task receipt after decorating the original
    // message with task metadata. Current Servers retired that redundant row.
    return readSystemKind(message.author) !== 'task';
}

function readSystemKind(author: { system: 'reminder' | 'session' }): string {
    return author.system;
}
