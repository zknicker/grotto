import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { AgentLoading } from '../../features/members/agent-profile/agent-loading.tsx';
import { AgentProfilePage } from '../../features/members/agent-profile/agent-profile.tsx';
import { isAgentTab } from '../../features/members/agent-profile/agent-tabs.ts';
import { HumanProfile } from '../../features/members/human-profile/human-profile.tsx';
import { HostedHumanDirectory } from '../../features/servers/hosted-human-directory.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { agentRoute, membersRoute } from '../../features/servers/server-routes.ts';
import { useAgent } from '../../hooks/members/use-agent.ts';
import { useMember } from '../../hooks/members/use-member.ts';
import { useMembers } from '../../hooks/servers/use-members.ts';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

/** Members owns the stable detail column; child routes choose its content. */
export function MembersPage() {
    const context = useHostedServerContext();
    useWindowTitle('Members');

    return (
        <main className="flex min-h-0 flex-1">
            <Outlet context={context} />
        </main>
    );
}

export function MembersEmptyPage() {
    return <p className="m-auto text-muted text-sm">Select a member</p>;
}

export function AgentPage() {
    const { agentId = '', tab } = useParams();
    const navigate = useNavigate();
    const { server } = useHostedServerContext();
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
    const { server } = useHostedServerContext();
    const directory = useMembers(server.id);
    if (directory.error && !directory.data) {
        return <p className="m-auto text-danger text-sm">Couldn’t load humans.</p>;
    }
    return (
        <HostedHumanDirectory
            directory={directory.data}
            serverId={server.id}
            serverSlug={server.slug}
        />
    );
}

export function HumanPage() {
    const { userId = '' } = useParams();
    const { server } = useHostedServerContext();
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
