import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useAgentPresence } from '../../hooks/agents/use-agent-presence.ts';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { cn } from '../../lib/utils.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import { resolveDmPresenceLabel } from '../chats/agent-presence.tsx';
import { formatActiveStatusText } from '../chats/chat-active-status-stack.tsx';
import { buildChatList } from '../chats/chat-list-data.ts';
import { resolveCurrentChatId, resolveNavigableActivityChatId } from './sidebar-chat-list-model.ts';

const maximumVisibleAgents = 3;
const faceStyle = { flexShrink: 0, overflow: 'visible' } as const;

export function SidebarAgentActivityStrip() {
    const navigate = useNavigate();
    const currentChatId = resolveCurrentChatId(useLocation().pathname);
    const dark = useResolvedThemeOptional() === 'dark';
    const agents = useAgentList().data?.agents ?? [];
    const presence = useAgentPresence().data?.presence ?? [];
    const chats = buildChatList(useChatList().data);
    const busyAgents = presence.filter((entry) => entry.state === 'busy');
    const agentById = React.useMemo(
        () => new Map(agents.map((agent) => [agent.id, agent])),
        [agents]
    );

    if (busyAgents.length === 0) {
        return null;
    }

    const hiddenAgentCount = Math.max(0, busyAgents.length - maximumVisibleAgents);

    return (
        <Elevated className="absolute bottom-12 left-1 z-40 w-56 rounded-lg p-1" offset={2}>
            <div className="flex flex-col gap-0.5">
                {busyAgents.slice(0, maximumVisibleAgents).map((entry) => {
                    const agent = agentById.get(entry.agentId);
                    // Presence carries no chat anchor (specs/presence.md), so
                    // the strip can no longer resolve a live timeline or a
                    // chat to jump to for a busy agent.
                    const label = resolveDmPresenceLabel(entry, currentChatId ?? '') ?? 'Working…';
                    const navigableChatId = resolveNavigableActivityChatId(null, chats);

                    return (
                        <button
                            className={cn(
                                'flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-left',
                                navigableChatId
                                    ? 'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
                                    : 'cursor-default'
                            )}
                            disabled={!navigableChatId}
                            key={entry.agentId}
                            onClick={() => {
                                if (navigableChatId) {
                                    void navigate(appRoutes.chat(navigableChatId));
                                }
                            }}
                            type="button"
                        >
                            <span className="flex size-5 shrink-0 items-center justify-center overflow-visible">
                                <AgentFace
                                    animate={false}
                                    dark={dark}
                                    head={agent?.effectiveCharacter ?? 'none'}
                                    ink={resolveAgentInk(dark, agent?.effectivePrimaryColor)}
                                    size={20}
                                    style={faceStyle}
                                />
                            </span>
                            <StatusDot className="motion-safe:animate-pulse" status="warning" />
                            <span className="min-w-0 truncate text-meta text-muted-foreground">
                                {label}
                            </span>
                        </button>
                    );
                })}
                {hiddenAgentCount > 0 ? (
                    <span className="px-2 text-meta text-muted-foreground">
                        +{hiddenAgentCount} more
                    </span>
                ) : null}
            </div>
        </Elevated>
    );
}

export function resolveAgentActivityLabel(input: {
    agentId: string;
    agentName: string;
    fallbackLabel: string;
    timeline?: ChatTimelineState;
}) {
    const activeReply = input.timeline?.activeReplies.find(
        (reply) => reply.agentId === input.agentId
    );

    if (!(activeReply && input.timeline)) {
        return input.fallbackLabel;
    }

    return formatActiveStatusText({
        activeReply,
        agentName: input.agentName,
        rows: [...input.timeline.timeline, ...Object.values(input.timeline.turnEvidence).flat()],
    });
}
