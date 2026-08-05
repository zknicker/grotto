import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { AgentProfilePage } from '../../features/members/agent-profile/agent-profile.tsx';
import { isAgentTab } from '../../features/members/agent-profile/agent-tabs.ts';
import { HumanProfile } from '../../features/members/human-profile/human-profile.tsx';
import { HostedHumanDirectory } from '../../features/servers/hosted-human-directory.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverAgentRoute, serverMembersRoute } from '../../features/servers/server-routes.ts';
import { useAgent } from '../../hooks/members/use-agent.ts';
import { useMember } from '../../hooks/members/use-member.ts';
import { useServerMembers } from '../../hooks/servers/use-server-members.ts';

/** Members owns the stable detail column; child routes choose its content. */
export function ServerMembersPage() {
    const context = useHostedServerContext();

    return (
        <main className="flex min-h-0 flex-1">
            <Outlet context={context} />
        </main>
    );
}

export function ServerMembersEmptyPage() {
    return <p className="m-auto text-muted text-sm">Select a member</p>;
}

export function ServerAgentPage() {
    const { agentId = '', tab } = useParams();
    const navigate = useNavigate();
    const { server } = useHostedServerContext();
    const agent = useAgent(server.id, agentId);

    if (!isAgentTab(tab)) {
        return <Navigate replace to={serverAgentRoute(server.slug, agentId)} />;
    }
    if (agent.isPending) {
        return <p className="m-auto text-muted text-sm">Loading Agent…</p>;
    }
    if (!agent.data) {
        return <p className="m-auto text-muted text-sm">Agent unavailable</p>;
    }

    return (
        <AgentProfilePage
            agent={agent.data}
            key={agent.data.id}
            onDeleted={() => navigate(serverMembersRoute(server.slug), { replace: true })}
            onTabChange={(nextTab) => navigate(serverAgentRoute(server.slug, agentId, nextTab))}
            server={server}
            tab={tab}
        />
    );
}

export function ServerHumanDirectoryPage() {
    const { server } = useHostedServerContext();
    const directory = useServerMembers(server.id);
    return (
        <HostedHumanDirectory
            directory={directory.data}
            serverId={server.id}
            serverSlug={server.slug}
        />
    );
}

export function ServerHumanPage() {
    const { userId = '' } = useParams();
    const { server } = useHostedServerContext();
    const member = useMember(server.id, userId);

    if (member.isPending) {
        return <p className="m-auto text-muted text-sm">Loading member…</p>;
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
