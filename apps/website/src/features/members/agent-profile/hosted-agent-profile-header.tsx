import { Button, Tooltip } from '@heroui/react';
import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import { Cancel01Icon, Message01Icon, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
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
                'flex shrink-0 items-center justify-between gap-4',
                variant === 'page' ? 'px-5 py-3.5 sm:px-7' : 'px-4 py-3'
            )}
        >
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center">
                    <HostedAgentFace
                        agent={agent}
                        animate={agent.availability === 'working'}
                        size={variant === 'page' ? 44 : 40}
                    />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h1 className="truncate font-semibold text-foreground text-xl tracking-tight">
                        {agent.displayName}
                    </h1>
                    {agent.description ? (
                        <p className="truncate text-muted text-sm">{agent.description}</p>
                    ) : null}
                    <div className="flex items-center gap-1.5 text-muted text-xs">
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
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <ActionButton
                    icon={Message01Icon}
                    isDisabled={!agent.dmChatId}
                    label="Message"
                    onPress={() =>
                        agent.dmChatId && navigate(serverChatRoute(server.slug, agent.dmChatId))
                    }
                />
                <ActionButton
                    icon={StopIcon}
                    isDisabled={!state.data?.running || stop.isPending}
                    label="Stop"
                    onPress={() =>
                        withSaveErrorToast(() =>
                            stop.mutateAsync({ agentId: agent.id, serverId: server.id })
                        ).catch(() => undefined)
                    }
                />
                <ActionButton
                    icon={RefreshIcon}
                    isDisabled={restart.isPending}
                    label="Restart"
                    onPress={() =>
                        withSaveErrorToast(() =>
                            restart.mutateAsync({ agentId: agent.id, serverId: server.id })
                        ).catch(() => undefined)
                    }
                />
                {onClose ? (
                    <ActionButton icon={Cancel01Icon} label="Close" onPress={onClose} />
                ) : null}
            </div>
        </header>
    );
}

function ActionButton({
    icon,
    isDisabled,
    label,
    onPress,
}: {
    icon: Parameters<typeof Icon>[0]['icon'];
    isDisabled?: boolean;
    label: string;
    onPress: () => void;
}) {
    return (
        <Tooltip delay={0}>
            <Tooltip.Trigger>
                <Button
                    aria-label={label}
                    isDisabled={isDisabled}
                    isIconOnly
                    onPress={onPress}
                    size="sm"
                    variant="ghost"
                >
                    <Icon icon={icon} />
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
    );
}
