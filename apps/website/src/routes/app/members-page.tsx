import { Button } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { UserQuestion01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { AgentLoading } from '../../features/members/agent-profile/agent-loading.tsx';
import { AgentProfilePage } from '../../features/members/agent-profile/agent-profile.tsx';
import { isAgentTab } from '../../features/members/agent-profile/agent-tabs.ts';
import { HumanProfile } from '../../features/members/human-profile/human-profile.tsx';
import { MemberRoster } from '../../features/members/member-roster.tsx';
import { useServerContext } from '../../features/servers/server-context.ts';
import { agentRoute, membersRoute } from '../../features/servers/server-routes.ts';
import { AgentsUsageOverview } from '../../features/usage/agents-usage-overview.tsx';
import { useAgent } from '../../hooks/members/use-agent.ts';
import { useMember } from '../../hooks/members/use-member.ts';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

/**
 * Members owns its own roster column plus the stable detail column; child
 * routes choose the detail content. The roster is on the page rather than in
 * the shell sidebar, because only Settings replaces the chat navigation.
 */
export function MembersPage() {
    const context = useServerContext();
    useWindowTitle('Members');

    return (
        <div className="flex min-h-0 min-w-0 flex-1">
            <MemberRoster server={context.server} />
            <main className="flex min-h-0 min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
                <Outlet context={context} />
            </main>
        </div>
    );
}

export function AgentsOverviewPage() {
    const { server } = useServerContext();
    useWindowTitle('Agents Overview');
    return <AgentsUsageOverview serverId={server.id} />;
}

export function AgentPage() {
    const { agentId = '', tab } = useParams();
    const navigate = useNavigate();
    const { server } = useServerContext();
    const agent = useAgent(server.id, agentId);

    if (!isAgentTab(tab)) {
        return <Navigate replace to={agentRoute(server.slug, agentId)} />;
    }
    if (agent.isPending) {
        return (
            <div className="m-auto w-full max-w-3xl px-6">
                <AgentLoading label="Loading Agent" />
            </div>
        );
    }
    if (!agent.data) {
        return (
            <div className="m-auto p-6">
                <EmptyState>
                    <EmptyState.Header>
                        <EmptyState.Media variant="icon">
                            <Icon aria-hidden="true" icon={UserQuestion01Icon} />
                        </EmptyState.Media>
                        <EmptyState.Title>Agent unavailable</EmptyState.Title>
                        <EmptyState.Description>
                            This Agent may have been removed, or the link points somewhere that no
                            longer exists.
                        </EmptyState.Description>
                    </EmptyState.Header>
                    <EmptyState.Content>
                        <Button
                            onPress={() => navigate(membersRoute(server.slug))}
                            variant="secondary"
                        >
                            Back to Members
                        </Button>
                    </EmptyState.Content>
                </EmptyState>
            </div>
        );
    }

    return (
        <AgentProfilePage
            agent={agent.data}
            key={agent.data.id}
            onDeleted={() => navigate(membersRoute(server.slug), { replace: true })}
            onTabChange={(nextTab) => navigate(agentRoute(server.slug, agentId, nextTab))}
            server={server}
            tab={tab}
        />
    );
}

export function HumanPage() {
    const { userId = '' } = useParams();
    const { server } = useServerContext();
    const member = useMember(server.id, userId);

    if (member.isPending) {
        return (
            <div className="m-auto w-full max-w-3xl px-6">
                <AgentLoading label="Loading member" />
            </div>
        );
    }
    if (!member.data) {
        return <p className="m-auto text-muted text-sm">Member unavailable</p>;
    }

    return (
        <HumanProfile
            agentHref={(agentId) => agentRoute(server.slug, agentId)}
            key={member.data.userId}
            member={member.data}
            server={server}
            viewerUserId={server.viewerUserId}
        />
    );
}
