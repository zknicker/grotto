import { Chip } from '@heroui/react';
import { ComputerIcon, ShieldUserIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import { Link } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import { useComputers } from '../../../hooks/members/use-computers.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { computerHealthLabel, computerHealthStatus } from '../../computers/computer-detail.tsx';
import { computerLabel } from '../../computers/presentation.ts';
import { serverComputersRoute } from '../../servers/server-routes.ts';
import { SettingsPage } from '../../settings/layout/settings-page.tsx';
import { hostedAvailabilityStatus } from '../agent-avatar.tsx';
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
    agent: HostedAgent;
    onDeleted: () => void;
    server: ServerDetail;
}) {
    const computers = useComputers(server.id);
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const inventory = computer?.reportedInventory;
    const canEdit = server.role === 'owner' || server.role === 'admin';

    return (
        <div className="px-4 py-6">
            <SettingsPage>
                <AgentIdentity
                    agent={agent}
                    canEdit={canEdit}
                    serverId={server.id}
                    status={
                        <div className="flex shrink-0 items-center gap-1.5 text-muted text-sm">
                            <StatusDot status={hostedAvailabilityStatus(agent.availability)} />
                            <span className="capitalize">{agent.availability}</span>
                        </div>
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
                                        <Chip className="max-w-full" variant="primary">
                                            <Icon
                                                className="size-4 shrink-0 text-muted"
                                                icon={ComputerIcon}
                                            />
                                            <StatusDot
                                                status={computerHealthStatus(computer.health)}
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
                <AgentRuntime
                    agent={agent}
                    canEdit={canEdit}
                    computerHealth={computer?.health}
                    runtimes={inventory?.runtimes ?? []}
                    serverId={server.id}
                />
                {canEdit ? <AgentSession agent={agent} server={server} /> : null}
                <AgentDanger agent={agent} onDeleted={onDeleted} server={server} />
            </SettingsPage>
        </div>
    );
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
