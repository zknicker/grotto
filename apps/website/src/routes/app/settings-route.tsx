import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ComputerPage } from '../../features/computers/computer-page.tsx';
import { RequireOperator } from '../../features/servers/require-operator.tsx';
import { useServerContext } from '../../features/servers/server-context.ts';
import { serverComputersRoute } from '../../features/servers/server-routes.ts';
import { AppearanceSettings } from '../../features/settings/appearance/page.tsx';
import { BrowserSettingsPage } from '../../features/settings/browser/page.tsx';
import { ConnectionsPage } from '../../features/settings/mcp/connections-page.tsx';
import { ModelsSettings } from '../../features/settings/models/page.tsx';
import { ProfileSettings } from '../../features/settings/profile/page.tsx';
import { ServerSettings } from '../../features/settings/server/page.tsx';
import { UpdatesSettings } from '../../features/settings/updates/page.tsx';
import { SkillsSettings } from '../../features/skills/skills-settings.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';

interface SectionContext {
    server: ServerSummary;
}

/** Section registry: one renderer per settings section, no dispatch chain. */
const sections: Record<string, (context: SectionContext) => ReactNode> = {
    appearance: () => <AppearanceSettings />,
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
    models: ({ server }) => <ModelsSettings serverId={server.id} />,
    profile: ({ server }) => <ProfileSettings serverId={server.id} />,
    server: ({ server }) => <ServerSettings server={server} />,
    skills: ({ server }) => <SkillsSettings serverId={server.id} />,
    updates: ({ server }) => (
        <UpdatesSettings computerSettingsHref={serverComputersRoute(server.slug)} />
    ),
};

export function SettingsSectionRoute() {
    const { section = 'appearance' } = useParams();
    const { server } = useServerContext();
    const render = sections[section];
    if (!render) {
        return <Navigate replace to="../appearance" />;
    }
    return render({ server });
}
