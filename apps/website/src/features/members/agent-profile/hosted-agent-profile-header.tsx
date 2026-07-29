import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import { Cancel01Icon, Message01Icon, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import { Tooltip } from '../../../components/ui/tooltip.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSaveErrorToast } from '../../../lib/saving-toast.ts';
import { cn } from '../../../lib/utils.ts';
import { serverChatRoute } from '../../servers/server-routes.ts';
import { HostedAgentFace } from '../hosted-agent-face.tsx';

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
                    <HostedAgentFace
                        agent={agent}
                        animate={agent.availability === 'working'}
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
                        <StatusDot
                            status={
                                agent.availability === 'working'
                                    ? 'warning'
                                    : agent.availability === 'idle'
                                      ? 'success'
                                      : 'muted'
                            }
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
                    onClick={() =>
                        withSaveErrorToast(() =>
                            stop.mutateAsync({ agentId: agent.id, serverId: server.id })
                        ).catch(() => undefined)
                    }
                />
                <ActionButton
                    disabled={restart.isPending}
                    icon={RefreshIcon}
                    label="Restart"
                    onClick={() =>
                        withSaveErrorToast(() =>
                            restart.mutateAsync({ agentId: agent.id, serverId: server.id })
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
