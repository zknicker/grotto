import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import { Cancel01Icon, Message01Icon, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import { resolveAgentDefaultCharacter } from '@tavern/api/agent-appearance';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Tooltip } from '../../../components/ui/tooltip.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { cn } from '../../../lib/utils.ts';
import { AgentFace } from '../../chats/agent-face.tsx';
import { serverChatRoute } from '../../servers/server-routes.ts';

export function HostedAgentProfileHeader({
    agent,
    onClose,
    server,
    variant,
}: {
    agent: HostedAgent;
    onClose?: () => void;
    server: ServerDetail;
    variant: 'page' | 'pane';
}) {
    const navigate = useNavigate();
    const utils = grottoTrpc.useUtils();
    const state = grottoTrpc.agent.deliveryState.useQuery({
        agentId: agent.id,
        serverId: server.id,
    });
    const stop = grottoTrpc.agent.stop.useMutation({ onSuccess: invalidate });
    const restart = grottoTrpc.agent.restart.useMutation({ onSuccess: invalidate });

    function invalidate() {
        void Promise.all([
            utils.agent.deliveryState.invalidate({ agentId: agent.id, serverId: server.id }),
            utils.agent.list.invalidate({ serverId: server.id }),
        ]);
    }

    return (
        <header
            className={cn(
                'flex shrink-0 items-center justify-between gap-4 border-[var(--content-card-border)] border-b',
                variant === 'page' ? 'px-6 py-4' : 'px-4 py-3'
            )}
        >
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-14 shrink-0 items-center justify-center">
                    <AgentFace
                        animate={agent.availability === 'working'}
                        head={resolveAgentDefaultCharacter(agent.id)}
                        size={variant === 'page' ? 52 : 44}
                    />
                </span>
                <div className="min-w-0">
                    <h1 className="truncate font-bold text-foreground text-xl">
                        {agent.displayName}
                    </h1>
                    {agent.description ? (
                        <p className="truncate text-muted-foreground text-sm">
                            {agent.description}
                        </p>
                    ) : null}
                    <span className="mt-0.5 flex items-center gap-1.5 text-meta text-muted-foreground">
                        <span
                            className={cn(
                                'size-2 rounded-full',
                                agent.availability === 'working'
                                    ? 'bg-warning'
                                    : agent.availability === 'idle'
                                      ? 'bg-success'
                                      : 'bg-muted-foreground'
                            )}
                        />
                        <span className="capitalize">{agent.availability}</span>
                    </span>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <ActionButton
                    disabled={!agent.dmChatId}
                    icon={Message01Icon}
                    label="Message"
                    onClick={() =>
                        agent.dmChatId && navigate(serverChatRoute(server.slug, agent.dmChatId))
                    }
                />
                <ActionButton
                    disabled={!state.data?.running || stop.isPending}
                    icon={StopIcon}
                    label="Stop"
                    onClick={() => stop.mutate({ agentId: agent.id, serverId: server.id })}
                />
                <ActionButton
                    disabled={restart.isPending}
                    icon={RefreshIcon}
                    label="Restart"
                    onClick={() => restart.mutate({ agentId: agent.id, serverId: server.id })}
                />
                {onClose ? (
                    <ActionButton icon={Cancel01Icon} label="Close" onClick={onClose} />
                ) : null}
            </div>
        </header>
    );
}

function ActionButton({
    disabled,
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
                variant="chrome"
            >
                <Icon icon={icon} />
            </Button>
        </Tooltip>
    );
}
