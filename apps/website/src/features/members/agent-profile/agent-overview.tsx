import type { Agent } from '@grotto/api';
import { Chip } from '@heroui/react';
import { ComputerIcon, ShieldUserIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Link } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import {
    computerHealthColor,
    computerHealthLabel,
    computerLabel,
} from '../../computers/presentation.ts';
import { serverComputersRoute } from '../../servers/server-routes.ts';
import { PageColumn } from '../../shell/page-column.tsx';
import { AgentUsageOverview } from '../../usage/agent-usage-overview.tsx';
import { AgentDanger } from './agent-danger.tsx';
import { AgentIdentity } from './agent-identity.tsx';
import { AgentRuntime } from './agent-runtime.tsx';
import { AgentSession } from './agent-session.tsx';

export function AgentOverview({
    agent,
    onDeleted,
    server,
}: {
    agent: Agent;
    onDeleted: () => void;
    server: ServerDetail;
}) {
    const computers = useComputers(server.id);
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const inventory = computer?.reportedInventory;
    const canEdit = server.role === 'owner' || server.role === 'admin';

    return (
        <PageColumn>
            <AgentIdentity
                agent={agent}
                badges={
                    <>
                        <Chip
                            color={agent.role === 'member' ? 'default' : 'accent'}
                            size="sm"
                            variant="soft"
                        >
                            <Icon className="size-4 shrink-0" icon={ShieldUserIcon} />
                            <Chip.Label className="capitalize">{agent.role}</Chip.Label>
                        </Chip>
                        {computer ? (
                            <Link
                                className="block min-w-0"
                                to={`${serverComputersRoute(server.slug)}?computer=${encodeURIComponent(computer.id)}`}
                            >
                                <Chip
                                    className="max-w-full"
                                    color={computerHealthColor(computer.health)}
                                    size="sm"
                                    variant="soft"
                                >
                                    <Icon
                                        className="size-4 shrink-0 text-muted"
                                        icon={ComputerIcon}
                                    />
                                    <Chip.Label className="min-w-0 truncate">
                                        {computerLabel(computer)}
                                        <span className="ms-2 font-normal text-muted">
                                            {computerHealthLabel(computer.health)}
                                        </span>
                                    </Chip.Label>
                                </Chip>
                            </Link>
                        ) : null}
                    </>
                }
                canEdit={canEdit}
                generationAvailable={server.avatarGenerationAvailable}
                serverId={server.id}
                trailing={
                    <span className="tabular-nums">Created {formatDate(agent.createdAt)}</span>
                }
            />
            <AgentUsageOverview agent={agent} serverId={server.id} />
            <AgentRuntime
                agent={agent}
                canEdit={canEdit}
                computerHealth={computer?.health}
                runtimes={inventory?.runtimes ?? []}
                serverId={server.id}
            />
            {canEdit ? <AgentSession agent={agent} server={server} /> : null}
            <AgentDanger agent={agent} onDeleted={onDeleted} server={server} />
        </PageColumn>
    );
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
