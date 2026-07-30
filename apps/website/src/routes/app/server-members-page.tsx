import { Plus } from '@hugeicons/core-free-icons';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { HostedAgentProfile } from '../../features/members/agent-profile/hosted-agent-profile.tsx';
import { CreateHostedAgentDialog } from '../../features/members/create-hosted-agent-dialog.tsx';
import { HostedAgentFace } from '../../features/members/hosted-agent-face.tsx';
import { HumanMemberSection } from '../../features/members/human-member-list.tsx';
import { MembersPageFrame } from '../../features/members/members-page.tsx';
import { HostedHumanDirectory } from '../../features/servers/hosted-human-directory.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverMembersRoute } from '../../features/servers/server-routes.ts';
import { useServerMembers } from '../../hooks/servers/use-server-members.ts';
import { cn } from '../../lib/utils.ts';

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
                        <button
                            aria-label="Create agent"
                            className="no-drag flex size-5 cursor-pointer items-center justify-center rounded-md text-sidebar-muted hover:bg-[var(--nav-hover)] hover:text-foreground"
                            onClick={() => setCreatingAgent(true)}
                            title="Create agent"
                            type="button"
                        >
                            <Icon aria-hidden="true" icon={Plus} size={14} />
                        </button>
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
                    <p className="m-auto text-muted-foreground text-sm">Select a member</p>
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
                                    'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--nav-hover)]',
                                    isActive && humansSelected
                                        ? 'bg-secondary shadow-[0_2px_0_0_var(--hard-shadow)] ring-1 ring-input ring-inset'
                                        : null
                                )
                            }
                            key={member.userId}
                            to={humansRoute}
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs">
                                {member.userId.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate font-medium text-sm">
                                    {member.userId}
                                </span>
                                <span className="block text-muted-foreground text-sm capitalize">
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
                cn(
                    'block rounded-lg px-2 py-2 hover:bg-[var(--nav-hover)]',
                    isActive
                        ? 'bg-secondary shadow-[0_2px_0_0_var(--hard-shadow)] ring-1 ring-input ring-inset'
                        : null
                )
            }
            to={`${serverMembersRoute(slug)}/agents/${agent.id}`}
        >
            <span className="flex min-w-0 items-center gap-3">
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
                    <span
                        className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-sidebar ${
                            agent.availability === 'idle'
                                ? 'bg-success'
                                : agent.availability === 'working'
                                  ? 'bg-warning'
                                  : agent.availability === 'error'
                                    ? 'bg-error'
                                    : 'bg-muted-foreground'
                        }`}
                    />
                </span>
                <span className="min-w-0">
                    <span className="block truncate font-semibold text-sm">
                        {agent.displayName}
                    </span>
                    <span className="block truncate text-muted-foreground text-sm">
                        @{agent.handle}
                    </span>
                </span>
            </span>
        </NavLink>
    );
}
