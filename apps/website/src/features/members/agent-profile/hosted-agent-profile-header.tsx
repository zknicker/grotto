import { Button } from '@heroui/react';
import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import { Message01Icon, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSaveErrorToast } from '../../../lib/saving-toast.ts';
import { serverChatRoute } from '../../servers/server-routes.ts';
import { HostedAgentFace } from '../hosted-agent-face.tsx';

/** Compact identity cluster for the agent tab band: face, name, presence. */
export function HostedAgentIdentity({ agent }: { agent: HostedAgent }) {
    return (
        <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center">
                <HostedAgentFace
                    agent={agent}
                    animate={agent.availability === 'working'}
                    size={28}
                />
            </span>
            <h1 className="min-w-0 truncate font-semibold text-foreground text-sm">
                {agent.displayName}
            </h1>
            <span className="flex shrink-0 items-center gap-1.5 text-muted text-xs">
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
    );
}

/** Agent lifecycle actions, rendered inside the Profile tab content. */
export function HostedAgentActions({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
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
        <div className="flex flex-wrap items-center gap-2">
            <Button
                isDisabled={!agent.dmChatId}
                onPress={() =>
                    agent.dmChatId && navigate(serverChatRoute(server.slug, agent.dmChatId))
                }
                size="sm"
                variant="secondary"
            >
                <Icon aria-hidden="true" icon={Message01Icon} size={16} />
                Message
            </Button>
            <Button
                isDisabled={!state.data?.running || stop.isPending}
                onPress={() =>
                    withSaveErrorToast(() =>
                        stop.mutateAsync({ agentId: agent.id, serverId: server.id })
                    ).catch(() => undefined)
                }
                size="sm"
                variant="secondary"
            >
                <Icon aria-hidden="true" icon={StopIcon} size={16} />
                Stop
            </Button>
            <Button
                isDisabled={restart.isPending}
                isPending={restart.isPending}
                onPress={() =>
                    withSaveErrorToast(() =>
                        restart.mutateAsync({ agentId: agent.id, serverId: server.id })
                    ).catch(() => undefined)
                }
                size="sm"
                variant="secondary"
            >
                <Icon aria-hidden="true" icon={RefreshIcon} size={16} />
                Restart
            </Button>
        </div>
    );
}
