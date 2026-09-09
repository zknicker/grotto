import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AgentLoading } from '../../features/members/agent-profile/agent-loading.tsx';
import { AgentProfilePage } from '../../features/members/agent-profile/agent-profile.tsx';
import { isAgentTab } from '../../features/members/agent-profile/agent-tabs.ts';
import { useServerContext } from '../../features/servers/server-context.ts';
import {
    agentProfileRoute,
    serverSettingsSectionRoute,
} from '../../features/servers/server-routes.ts';
import { useAgent } from '../../hooks/members/use-agent.ts';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

/**
 * An Agent's own page, in the Server layout beside Usage.
 *
 * This rendered inside Settings, which read an Agent as a Members row: the
 * settings rail replaced the chat navigation and a breadcrumb claimed the
 * Agent belonged to a section. An Agent is a first-class product record, so
 * its page keeps the app's own navigation and owns its address. Humans stay
 * records under Settings > Members, and the old settings links redirect here.
 */
export function AgentProfileRoute() {
    const { agentId = '', tab } = useParams();
    const navigate = useNavigate();
    const { server } = useServerContext();
    const agent = useAgent(server.id, agentId);
    const membersRoute = serverSettingsSectionRoute(server.slug, 'members');
    useWindowTitle(agent.data?.displayName);

    if (!isAgentTab(tab)) {
        return <Navigate replace to={agentProfileRoute(server.slug, agentId)} />;
    }
    if (agent.isPending) {
        return (
            <div className="mx-auto w-full max-w-3xl px-6 pt-8">
                <AgentLoading label="Loading Agent" />
            </div>
        );
    }
    if (!agent.data) {
        return <Navigate replace to={membersRoute} />;
    }

    return (
        <AgentProfilePage
            agent={agent.data}
            key={agent.data.id}
            onDeleted={() => navigate(membersRoute, { replace: true })}
            onTabChange={(nextTab) => navigate(agentProfileRoute(server.slug, agentId, nextTab))}
            server={server}
            tab={tab}
        />
    );
}
