import { Badge } from '@heroui/react';
import { useAgentPresence } from '../../hooks/agents/use-agent-presence.ts';
import type { AgentPresenceOutput } from '../../lib/trpc.tsx';
import { type ChatListItem, getChatAgentId } from './chat-list-data.ts';

type AgentPresenceEntry = AgentPresenceOutput['presence'][number];

// Presence surfaces (specs/presence.md): one agent-scoped busy/idle fact
// rendered wherever the agent appears. "Replying here" stays the status
// stack's job; these surfaces answer "is the agent busy, and where".

/** Topbar presence for agent DMs: a quiet dot, plus text only when busy. */
export function AgentPresenceBadge({ chat }: { chat: ChatListItem }) {
    const presence = useAgentPresenceEntry(getChatAgentId(chat));
    if (chat.conversationKind === 'channel' || !presence) {
        return null;
    }
    const label = resolveDmPresenceLabel(presence, chat.id);

    return (
        <span className="flex min-w-0 items-center gap-1.5" data-slot="agent-presence">
            <AgentPresenceDot state={presence.state} />
            {label ? <span className="truncate text-muted text-sm">{label}</span> : null}
        </span>
    );
}

export function resolveDmPresenceLabel(presence: AgentPresenceEntry, _chatId: string) {
    return presence.state === 'busy' ? 'Working…' : null;
}

function AgentPresenceDot({ state }: { state: AgentPresenceEntry['state'] }) {
    return (
        <Badge
            className="static transform-none"
            color={state === 'busy' ? 'warning' : 'success'}
            data-state={state}
            size="sm"
        />
    );
}

/** Generic presence line: dot always, label only while busy. */
export function AgentPresenceStatusLine({ agentId }: { agentId: string }) {
    const presence = useAgentPresenceEntry(agentId);
    if (!presence) {
        return null;
    }

    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <AgentPresenceDot state={presence.state} />
            {presence.state === 'busy' ? (
                <span className="truncate text-muted text-sm">Working…</span>
            ) : null}
        </span>
    );
}

/** The agent's presence entry, or null while unknown. */
export function useAgentPresenceEntry(agentId: string | null) {
    const { data } = useAgentPresence();
    if (!agentId) {
        return null;
    }
    return data?.presence.find((entry) => entry.agentId === agentId) ?? null;
}
