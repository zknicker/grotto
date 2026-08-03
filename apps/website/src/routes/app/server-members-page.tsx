import { useLocation, useParams } from 'react-router-dom';
import { HostedAgentProfile } from '../../features/members/agent-profile/hosted-agent-profile.tsx';
import { HostedHumanProfile } from '../../features/members/human-profile/hosted-human-profile.tsx';
import { HostedHumanDirectory } from '../../features/servers/hosted-human-directory.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { useServerMembers } from '../../hooks/servers/use-server-members.ts';

/** Member detail column; the roster lives in the Members section sidebar. */
export function ServerMembersPage() {
    const { agentId, userId } = useParams();
    const location = useLocation();
    const { agents, server } = useHostedServerContext();
    const directory = useServerMembers(server.id);
    const selectedAgent = agents.find((agent) => agent.id === agentId) ?? null;
    const humansSelected = location.pathname.endsWith('/humans');
    const selectedHuman = directory.data?.members.find((entry) => entry.userId === userId) ?? null;

    return (
        <main className="flex min-h-0 flex-1">
            {selectedAgent ? (
                <HostedAgentProfile
                    agent={selectedAgent}
                    key={selectedAgent.id}
                    server={server}
                    variant="page"
                />
            ) : selectedHuman && directory.data ? (
                <HostedHumanProfile
                    key={selectedHuman.userId}
                    member={selectedHuman}
                    server={server}
                    viewerUserId={directory.data.viewerUserId}
                />
            ) : humansSelected ? (
                <HostedHumanDirectory
                    directory={directory.data}
                    serverId={server.id}
                    serverSlug={server.slug}
                />
            ) : (
                <p className="m-auto text-muted text-sm">Select a member</p>
            )}
        </main>
    );
}
