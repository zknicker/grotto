import { Button, Tooltip } from '@heroui/react';
import { Plus } from '@hugeicons/core-free-icons';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { HostedAgentProfile } from '../../features/members/agent-profile/hosted-agent-profile.tsx';
import { CreateHostedAgentDialog } from '../../features/members/create-hosted-agent-dialog.tsx';
import { HostedAgentFace } from '../../features/members/hosted-agent-face.tsx';
import { HumanMemberSection } from '../../features/members/human-member-list.tsx';
import { MembersPageFrame } from '../../features/members/members-page-frame.tsx';
import { HostedHumanDirectory } from '../../features/servers/hosted-human-directory.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverMembersRoute } from '../../features/servers/server-routes.ts';
import { useServerMembers } from '../../hooks/servers/use-server-members.ts';
import { cn } from '../../lib/utils.ts';

const memberRowClass =
    'flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus';

export function ServerMembersPage() {
    const { agentId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { agentListStatus, agents, server } = useHostedServerContext();
    const [creatingAgent, setCreatingAgent] = React.useState(false);
    const directory = useServerMembers(server.id);
    const selectedAgent = agents.find((agent) => agent.id === agentId) ?? null;
    const humansSelected = location.pathname.endsWith('/humans');
    const humansRoute = `${serverMembersRoute(server.slug)}/humans`;

    return (
        <MembersPageFrame
            agentCount={agents.length}
            agentListStatus={agentListStatus}
            agentRows={agents.map((agent) => (
                <AgentRow agent={agent} key={agent.id} slug={server.slug} />
            ))}
            createControl={
                server.role === 'owner' || server.role === 'admin' ? (
                    <>
                        <Tooltip delay={0}>
                            <Button
                                aria-label="Create Agent"
                                className="no-drag"
                                isIconOnly
                                onPress={() => setCreatingAgent(true)}
                                size="sm"
                                variant="ghost"
                            >
                                <Icon aria-hidden="true" icon={Plus} size={16} />
                            </Button>
                            <Tooltip.Content>Create Agent</Tooltip.Content>
                        </Tooltip>
                        <CreateHostedAgentDialog
                            agents={agents}
                            onCreated={(createdAgentId) => {
                                setCreatingAgent(false);
                                navigate(
                                    `${serverMembersRoute(server.slug)}/agents/${createdAgentId}`
                                );
                            }}
                            onOpenChange={setCreatingAgent}
                            open={creatingAgent}
                            serverId={server.id}
                        />
                    </>
                ) : null
            }
            detail={
                selectedAgent ? (
                    <HostedAgentProfile
                        agent={selectedAgent}
                        key={selectedAgent.id}
                        server={server}
                        variant="page"
                    />
                ) : humansSelected ? (
                    <HostedHumanDirectory
                        directory={directory.data}
                        serverId={server.id}
                        serverSlug={server.slug}
                    />
                ) : (
                    <p className="m-auto text-muted text-sm">Select a member</p>
                )
            }
            humanMembers={
                <HumanMemberSection
                    count={directory.data?.members.length ?? 0}
                    manageTo={humansRoute}
                >
                    {(directory.data?.members ?? []).map((member) => (
                        <NavLink
                            className={({ isActive }) =>
                                cn(
                                    memberRowClass,
                                    isActive && humansSelected ? 'bg-surface-secondary' : null
                                )
                            }
                            key={member.userId}
                            to={humansRoute}
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-xs">
                                {member.userId.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate font-medium text-sm">
                                    {member.userId}
                                </span>
                                <span className="block text-muted text-xs capitalize">
                                    {member.role}
                                </span>
                            </span>
                        </NavLink>
                    ))}
                </HumanMemberSection>
            }
        />
    );
}

function AgentRow({ agent, slug }: { agent: HostedAgent; slug: string }) {
    return (
        <NavLink
            className={({ isActive }) =>
                cn(memberRowClass, isActive ? 'bg-surface-secondary' : null)
            }
            to={`${serverMembersRoute(slug)}/agents/${agent.id}`}
        >
            <span className="relative flex size-8 shrink-0 items-center justify-center overflow-visible">
                <HostedAgentFace
                    agent={agent}
                    animate={false}
                    size={32}
                    style={{
                        flexShrink: 0,
                        height: 32,
                        overflow: 'visible',
                        width: 32,
                    }}
                />
                <StatusDot
                    className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface"
                    size="md"
                    status={agentStatus(agent.availability)}
                />
            </span>
            <span className="min-w-0">
                <span className="block truncate font-medium text-sm">{agent.displayName}</span>
                <span className="block truncate text-muted text-xs">@{agent.handle}</span>
            </span>
        </NavLink>
    );
}

function agentStatus(availability: HostedAgent['availability']) {
    switch (availability) {
        case 'idle':
            return 'success' as const;
        case 'working':
            return 'warning' as const;
        case 'error':
            return 'error' as const;
        default:
            return 'muted' as const;
    }
}
