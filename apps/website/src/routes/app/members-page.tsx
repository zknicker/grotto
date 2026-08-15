import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { AgentLoading } from '../../features/members/agent-profile/agent-loading.tsx';
import { AgentProfilePage } from '../../features/members/agent-profile/agent-profile.tsx';
import { isAgentTab } from '../../features/members/agent-profile/agent-tabs.ts';
import { HumanProfile } from '../../features/members/human-profile/human-profile.tsx';
import { HumanDirectory } from '../../features/servers/human-directory.tsx';
import { useServerContext } from '../../features/servers/server-context.ts';
import { agentRoute, membersRoute } from '../../features/servers/server-routes.ts';
import { AgentsUsageOverview } from '../../features/usage/agents-usage-overview.tsx';
import { useAgent } from '../../hooks/members/use-agent.ts';
import { useMember } from '../../hooks/members/use-member.ts';
import { useMembers } from '../../hooks/servers/use-members.ts';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

/** Members owns the stable detail column; child routes choose its content. */
export function MembersPage() {
    const context = useServerContext();
    useWindowTitle('Members');

    return (
        <main className="flex min-h-0 min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <Outlet context={context} />
        </main>
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
        return <p className="m-auto text-muted text-sm">Agent unavailable</p>;
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

export function HumanDirectoryPage() {
    const { server } = useServerContext();
    const directory = useMembers(server.id);
    if (directory.error && !directory.data) {
        return <p className="m-auto text-danger text-sm">Couldn’t load humans.</p>;
    }
    return (
        <HumanDirectory directory={directory.data} serverId={server.id} serverSlug={server.slug} />
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
            key={member.data.userId}
            member={member.data}
            server={server}
            viewerUserId={server.viewerUserId}
        />
    );
}
