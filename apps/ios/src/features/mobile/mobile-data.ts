import type { HostedAgent, HostedChat } from '@tavern/api';
import type { AgentSummary, ChatSummary } from './types';

export function toAgentSummary(agent: HostedAgent): AgentSummary {
    return {
        availability: agent.availability,
        avatarUrl: agent.avatarUrl,
        displayName: agent.displayName,
        id: agent.id,
        kind: 'agent',
    };
}

export function toChatSummary(chat: HostedChat): ChatSummary | null {
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
