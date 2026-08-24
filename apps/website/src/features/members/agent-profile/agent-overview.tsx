import { Chip } from '@heroui/react';
import { ComputerIcon, ShieldUserIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { Agent } from '@tavern/api';
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
import { availabilityBadgeColor } from '../agent-avatar.tsx';
import { MemberProfileFact, MemberProfileFacts } from '../member-profile-header.tsx';
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
        <div className="px-4 py-6">
            <PageColumn>
                <AgentIdentity
                    agent={agent}
                    canEdit={canEdit}
                    serverId={server.id}
                    status={
                        <Chip
                            className="capitalize"
                            color={availabilityBadgeColor(agent.availability)}
                            size="sm"
                            variant="soft"
                        >
                            {agent.availability}
                        </Chip>
                    }
                >
                    <MemberProfileFacts>
                        <MemberProfileFact
                            label="Role"
                            value={
                                <Chip
                                    color={agent.role === 'member' ? 'default' : 'accent'}
                                    variant="primary"
                                >
                                    <Icon className="size-4 shrink-0" icon={ShieldUserIcon} />
                                    <Chip.Label className="capitalize">{agent.role}</Chip.Label>
                                </Chip>
                            }
                        />
                        <MemberProfileFact
                            label="Computer"
                            value={
                                computer ? (
                                    <Link
                                        className="block min-w-0"
                                        to={`${serverComputersRoute(server.slug)}?computer=${encodeURIComponent(computer.id)}`}
                                    >
                                        <Chip
                                            className="max-w-full"
                                            color={computerHealthColor(computer.health)}
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
                                ) : (
                                    'Unavailable'
                                )
                            }
                        />
                        <MemberProfileFact
                            className="tabular-nums"
                            label="Created"
                            value={formatDate(agent.createdAt)}
                        />
                    </MemberProfileFacts>
                </AgentIdentity>
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
        </div>
    );
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
