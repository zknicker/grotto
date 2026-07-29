import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import { Cancel01Icon, Message01Icon, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import { useNavigate } from 'react-router-dom';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import { Tooltip } from '../../../components/ui/tooltip.tsx';
import { useAgentChatList } from '../../../hooks/agents/use-agent-chats.ts';
import { useStopAgent } from '../../../hooks/agents/use-agent-inbox.ts';
import { useAgentRestart } from '../../../hooks/agents/use-agent-session.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { withSaveErrorToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { resolveAgentInk } from '../../agents/agent-color-presets.ts';
import { AgentFace } from '../../chats/agent-face.tsx';
import { resolveDmPresenceLabel, useAgentPresenceEntry } from '../../chats/agent-presence.tsx';
import { getActiveRunIds } from '../../chats/chat-active-runs.ts';
import { selectMostRecentAgentChat } from './agent-chat-selection.ts';

type Agent = AgentListOutput['agents'][number];

export function AgentProfileHeader({
    agent,
    hostChatId,
    onClose,
    variant,
}: {
    agent: Agent;
    hostChatId?: string;
    onClose?: () => void;
    variant: 'page' | 'pane';
}) {
    const dark = useResolvedThemeOptional() === 'dark';
    const navigate = useNavigate();
    const chatsQuery = useAgentChatList({ agentId: agent.id });
    const directChat = selectMostRecentAgentChat(chatsQuery.data, 'direct');
    const presence = useAgentPresenceEntry(agent.id);
    const stopAgent = useStopAgent();
    const restartAgent = useAgentRestart();
    // Presence carries no chat anchor (specs/presence.md): busy always reads
    // as a plain "Working…", regardless of which chat this profile hosts.
    const presenceLabel = presence
        ? presence.state === 'busy'
            ? (resolveDmPresenceLabel(presence, hostChatId ?? '') ?? 'Working…')
            : 'Online'
        : 'Status unavailable';

    return (
        <header
            className={cn(
                'flex shrink-0 items-center justify-between gap-4 border-[var(--content-card-border)] border-b',
                variant === 'page' ? 'px-6 py-4' : 'px-4 py-3'
            )}
        >
            <div className="flex min-w-0 items-center gap-3">
                <span
                    aria-hidden="true"
                    className="flex size-14 shrink-0 items-center justify-center"
                >
                    <AgentFace
                        animate={presence?.state === 'busy'}
                        dark={dark}
                        head={agent.effectiveCharacter}
                        ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                        size={variant === 'page' ? 52 : 44}
                    />
                </span>
                <div className="min-w-0">
                    <h1 className="truncate font-bold text-foreground text-xl">{agent.name}</h1>
                    {agent.bio ? (
                        <p className="truncate text-muted-foreground text-sm">{agent.bio}</p>
                    ) : null}
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-meta text-muted-foreground">
                        <StatusDot
                            status={
                                presence?.state === 'busy'
                                    ? 'warning'
                                    : presence
                                      ? 'success'
                                      : 'muted'
                            }
                        />
                        <span className="truncate">{presenceLabel}</span>
                    </span>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <ActionButton
                    disabled={!directChat}
                    icon={Message01Icon}
                    label={directChat ? 'Message' : 'No direct message chat yet'}
                    onClick={() => directChat && navigate(appRoutes.chat(directChat.id))}
                />
                {/* Stop lives on agent presence (I1): it stops the
                        running turn and clears the queued backlog. */}
                <ActionButton
                    disabled={presence?.state !== 'busy' || stopAgent.isPending}
                    icon={StopIcon}
                    label={presence?.state === 'busy' ? 'Stop' : 'Agent is not working'}
                    onClick={() => stopAgent.mutate({ agentId: agent.id })}
                />
                {/* Restart resumes the current session unchanged (no
                        rotation, no receipt): it interrupts a stuck turn and
                        re-drives the session. */}
                <ActionButton
                    disabled={restartAgent.isPending}
                    icon={RefreshIcon}
                    label="Restart"
                    onClick={() =>
                        withSaveErrorToast(() =>
                            restartAgent.mutateAsync({ agentId: agent.id })
                        ).catch(() => undefined)
                    }
                />
                {onClose ? (
                    <ActionButton icon={Cancel01Icon} label="Close" onClick={onClose} />
                ) : null}
            </div>
        </header>
    );
}

function ActionButton({
    disabled = false,
    icon,
    label,
    onClick,
}: {
    disabled?: boolean;
    icon: Parameters<typeof Icon>[0]['icon'];
    label: string;
    onClick: () => void;
}) {
    return (
        <Tooltip content={label}>
            <Button
                aria-label={label}
                disabled={disabled}
                onClick={onClick}
                size="icon"
                title={label}
                variant="chrome"
            >
                <Icon icon={icon} />
            </Button>
        </Tooltip>
    );
}

export function selectAgentRunId(
    timeline: {
        activeReplies: readonly { agentId: string; completedAt?: string | null; runId: string }[];
        activeTurns: readonly { agentId: string; runId: string }[];
    },
    agentId: string
) {
    const agentRunIds = new Set(
        [...timeline.activeTurns, ...timeline.activeReplies]
            .filter((turn) => turn.agentId === agentId)
            .map((turn) => turn.runId)
    );
    return getActiveRunIds(timeline).find((candidate) => agentRunIds.has(candidate)) ?? null;
}
