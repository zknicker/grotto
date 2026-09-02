import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ComputerPage } from '../../features/computers/computer-page.tsx';
import { AgentLoading } from '../../features/members/agent-profile/agent-loading.tsx';
import { AgentProfilePage } from '../../features/members/agent-profile/agent-profile.tsx';
import { isAgentTab } from '../../features/members/agent-profile/agent-tabs.ts';
import { HumanProfile } from '../../features/members/human-profile/human-profile.tsx';
import { HumanDirectory } from '../../features/servers/human-directory.tsx';
import { RequireOperator } from '../../features/servers/require-operator.tsx';
import { useServerContext } from '../../features/servers/server-context.ts';
import {
    serverSettingsSectionRoute,
    settingsAgentRoute,
} from '../../features/servers/server-routes.ts';
import { BrowserSettingsPage } from '../../features/settings/browser/page.tsx';
import { ConnectionsPage } from '../../features/settings/mcp/connections-page.tsx';
import { ModelsSettings } from '../../features/settings/models/page.tsx';
import { PreferencesSettings } from '../../features/settings/preferences/page.tsx';
import { ProfileSettings } from '../../features/settings/profile/page.tsx';
import { ServerSettings } from '../../features/settings/server/page.tsx';
import { SkillsSettings } from '../../features/skills/skills-settings.tsx';
import { useAgent } from '../../hooks/members/use-agent.ts';
import { useMember } from '../../hooks/members/use-member.ts';
import { useMembers } from '../../hooks/servers/use-members.ts';
import type { ServerSummary } from '../../lib/grotto-server.tsx';

interface SectionContext {
    server: ServerSummary;
}

/** Section registry: one renderer per settings section, no dispatch chain. */
const sections: Record<string, (context: SectionContext) => ReactNode> = {
    browser: ({ server }) => <BrowserSettingsPage serverId={server.id} />,
    computers: ({ server }) => (
        <RequireOperator
            description="Computers are attached and removed by Server operators."
            role={server.role}
        >
            <ComputerPage serverId={server.id} serverSlug={server.slug} />
        </RequireOperator>
    ),
    connections: () => <ConnectionsPage embedded />,
    members: ({ server }) => <MembersSection server={server} />,
    models: ({ server }) => <ModelsSettings serverId={server.id} />,
    preferences: () => <PreferencesSettings />,
    profile: ({ server }) => <ProfileSettings serverId={server.id} />,
    server: ({ server }) => <ServerSettings server={server} />,
    skills: ({ server }) => <SkillsSettings serverId={server.id} />,
};

/** Sections that moved; old links still resolve. */
const renamedSections: Record<string, string> = {
    appearance: 'preferences',
    updates: 'preferences',
};

export function SettingsSectionRoute() {
    const { section = 'profile' } = useParams();
    const { server } = useServerContext();
    const renamed = renamedSections[section];
    if (renamed) {
        return <Navigate replace to={`../${renamed}`} />;
    }
    const render = sections[section];
    if (!render) {
        return <Navigate replace to="../profile" />;
    }
    return render({ server });
}

function MembersSection({ server }: { server: ServerSummary }) {
    const directory = useMembers(server.id);
    const canManage = server.role === 'owner' || server.role === 'admin';

    if (directory.error && !directory.data) {
        return <p className="m-auto text-danger text-sm">Couldn’t load humans.</p>;
    }
    return (
        <HumanDirectory
            canManage={canManage}
            directory={directory.data}
            serverId={server.id}
            serverSlug={server.slug}
        />
    );
}

/**
 * A Member's detail, still inside Settings.
 *
 * These were reachable only through the members browser, which replaces the
 * whole navigation rail — so opening a row in the Members directory threw the
 * reader out of Settings entirely. The breadcrumb carries the extra level.
 */
export function SettingsAgentRoute() {
    const { agentId = '', tab } = useParams();
    const navigate = useNavigate();
    const { server } = useServerContext();
    const agent = useAgent(server.id, agentId);
    const membersRoute = serverSettingsSectionRoute(server.slug, 'members');

    if (!isAgentTab(tab)) {
        return <Navigate replace to={settingsAgentRoute(server.slug, agentId)} />;
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
            onTabChange={(nextTab) => navigate(settingsAgentRoute(server.slug, agentId, nextTab))}
            server={server}
            tab={tab}
        />
    );
}

export function SettingsHumanRoute() {
    const { userId = '' } = useParams();
    const { server } = useServerContext();
    const member = useMember(server.id, userId);

    if (member.isPending) {
        return (
            <div className="mx-auto w-full max-w-3xl px-6 pt-8">
                <AgentLoading label="Loading member" />
            </div>
        );
    }
    if (!member.data) {
        return <Navigate replace to={serverSettingsSectionRoute(server.slug, 'members')} />;
    }

    return (
        <HumanProfile
            agentHref={(agentId) => settingsAgentRoute(server.slug, agentId)}
            key={member.data.userId}
            member={member.data}
            server={server}
            viewerUserId={server.viewerUserId}
        />
    );
}
