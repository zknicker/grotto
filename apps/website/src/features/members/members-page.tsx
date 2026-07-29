import { Plus } from '@hugeicons/core-free-icons';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Menu,
    MenuItem,
    MenuPopup,
    MenuSeparator,
    MenuTrigger,
} from '../../components/ui/menu.tsx';
import { navSelectedClass } from '../../components/ui/nav.tsx';
import { SidePane } from '../../components/ui/pane.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { withSavingToast } from '../../lib/saving-toast.ts';
import { trpc } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { type AgentArchetypeProposal, agentArchetypeProposals } from './agent-archetypes.ts';
import { AgentProfile } from './agent-profile/agent-profile.tsx';
import { createNewAgentName } from './create-agent-name.ts';
import { HumanMemberList } from './human-member-list.tsx';
import { MemberAgentLabel } from './member-agent-label.tsx';
import { MembersAdmin } from './members-admin.tsx';
import { isHumansMembersPath } from './members-route.ts';

export function MembersPage() {
    const { agentId } = useParams();
    const isHumansAdmin = isHumansMembersPath(useLocation().pathname);
    const navigate = useNavigate();
    const utils = trpc.useUtils();
    const agentsQuery = useAgentList();
    const agents = agentsQuery.data?.agents ?? [];
    const selectedAgent = agents.find((agent) => agent.id === agentId) ?? null;
    const createAgent = trpc.agent.create.useMutation({
        onSuccess: async ({ agent }) => {
            await Promise.all([
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.chat.list.invalidate(),
                utils.model.list.invalidate(),
            ]);
            navigate(appRoutes.memberAgent(agent.id));
        },
    });
    const handleCreate = (proposal: AgentArchetypeProposal | null) => {
        void withSavingToast(() =>
            createAgent.mutateAsync({
                archetype: proposal?.id,
                bio: proposal?.bio,
                name: createNewAgentName(agents, proposal?.handle),
            })
        ).catch(() => undefined);
    };

    const createControl = (
        <Menu>
            <MenuTrigger
                aria-label="Create agent"
                className="no-drag flex size-5 cursor-pointer items-center justify-center rounded-md text-sidebar-muted hover:bg-[var(--nav-hover)] hover:text-foreground disabled:cursor-default disabled:opacity-50"
                disabled={createAgent.isPending}
                title="Create agent"
            >
                <Icon aria-hidden="true" icon={Plus} size={14} />
            </MenuTrigger>
            <MenuPopup align="start" className="w-72">
                <MenuItem onClick={() => handleCreate(null)}>
                    <div className="flex flex-col gap-0.5 py-0.5">
                        <span>Blank agent</span>
                        <span className="text-muted-foreground text-xs">
                            Starts with no role; its lane emerges from work
                        </span>
                    </div>
                </MenuItem>
                <MenuSeparator />
                {agentArchetypeProposals.map((proposal) => (
                    <MenuItem key={proposal.id} onClick={() => handleCreate(proposal)}>
                        <div className="flex flex-col gap-0.5 py-0.5">
                            <span>{proposal.label}</span>
                            <span className="text-muted-foreground text-xs">
                                {proposal.tagline}
                            </span>
                        </div>
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );

    return (
        <MembersPageFrame
            agentCount={agents.length}
            agentListStatus={
                agentsQuery.data ? 'ready' : agentsQuery.isPending ? 'loading' : 'error'
            }
            agentRows={agents.map((agent) => (
                <NavLink
                    className={({ isActive }) =>
                        cn(
                            'block rounded-lg px-2 py-2 hover:bg-[var(--nav-hover)]',
                            isActive ? navSelectedClass : null
                        )
                    }
                    key={agent.id}
                    to={appRoutes.memberAgent(agent.id)}
                >
                    <MemberAgentLabel agent={agent} showPresence />
                </NavLink>
            ))}
            createControl={createControl}
            detail={
                isHumansAdmin ? (
                    <div className="min-w-0 flex-1 overflow-y-auto">
                        <MembersAdmin />
                    </div>
                ) : agentId ? (
                    selectedAgent ? (
                        <AgentProfile
                            agentId={selectedAgent.id}
                            key={selectedAgent.id}
                            variant="page"
                        />
                    ) : agentsQuery.isPending ? null : (
                        <p className="m-auto text-muted-foreground text-sm">Member not found.</p>
                    )
                ) : (
                    <p className="m-auto text-muted-foreground text-sm">Select a member</p>
                )
            }
            humanMembers={<HumanMemberList />}
        />
    );
}

export function MembersPageFrame({
    agentCount,
    agentListStatus,
    agentRows,
    createControl,
    detail,
    humanMembers,
}: {
    agentCount: number;
    agentListStatus: 'error' | 'loading' | 'ready';
    agentRows: ReactNode;
    createControl?: ReactNode;
    detail: ReactNode;
    humanMembers: ReactNode;
}) {
    return (
        <main className="flex min-h-0 flex-1">
            <SidePane
                className="app-shell-sidebar-top-inset w-72 flex-col overflow-y-auto bg-[var(--sidebar)] pb-6"
                side="left"
            >
                <section>
                    <div className="mb-2 flex items-center justify-between px-3">
                        <h1 className="flex items-center gap-2 font-mono text-sidebar-muted text-xs uppercase tracking-wider">
                            <span>Agents</span>
                            {agentListStatus === 'ready' ? (
                                <span className="tabular-nums">{agentCount}</span>
                            ) : null}
                        </h1>
                        {createControl}
                    </div>
                    <div className="space-y-1 px-2">
                        {agentListStatus === 'loading' ? (
                            <p className="px-2 py-2 text-sidebar-muted text-xs">Loading Agents…</p>
                        ) : agentListStatus === 'error' ? (
                            <p className="px-2 py-2 text-sidebar-muted text-xs" role="alert">
                                Couldn’t load Agents
                            </p>
                        ) : (
                            agentRows
                        )}
                    </div>
                </section>
                <div className="px-2">{humanMembers}</div>
            </SidePane>
            <section className="flex min-w-0 flex-1">{detail}</section>
        </main>
    );
}
