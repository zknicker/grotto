import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverComputersRoute } from '../../features/servers/server-routes.ts';
import { AppearanceSettings } from '../../features/settings/appearance/page.tsx';
import { HostedBrowserSettingsPage } from '../../features/settings/browser/hosted-page.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../features/settings/layout/settings-page.tsx';
import type { HostedModelsComputer } from '../../features/settings/models/hosted-catalog.ts';
import { HostedModelsSettings } from '../../features/settings/models/hosted-page.tsx';
import { ProfileSettings } from '../../features/settings/profile/page.tsx';
import { ServerSettings } from '../../features/settings/server/page.tsx';
import { UpdatesSettings } from '../../features/settings/updates/page.tsx';
import { HostedSkillsBrowser } from '../../features/skills/hosted-skills-browser.tsx';
import { HostedStatsSettings } from '../../features/stats/hosted-stats.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { ServerConnectionsPage } from './server-connections-page.tsx';

interface SectionComputer extends HostedModelsComputer {
    health: string;
}

interface SectionContext {
    computers: SectionComputer[];
    server: ServerSummary;
}

const computerBackedSections = new Set(['browser', 'models', 'skills']);

/** Section registry: one renderer per settings section, no dispatch chain. */
const sections: Record<string, (context: SectionContext) => ReactNode> = {
    appearance: () => <AppearanceSettings />,
    browser: ({ computers, server }) => {
        const computer = computers.find((item) => item.health === 'healthy');
        return computer ? (
            <HostedBrowserSettingsPage computerId={computer.id} serverId={server.id} />
        ) : (
            <MissingComputerSettings
                description="Attach an online Computer to manage its Browser."
                title="Browser"
            />
        );
    },
    connections: () => <ServerConnectionsPage embedded />,
    models: ({ computers }) => <HostedModelsSettings computers={computers} />,
    profile: ({ server }) => <ProfileSettings serverId={server.id} />,
    server: ({ server }) => <ServerSettings server={server} />,
    skills: ({ computers }) => (
        <HostedSkillsBrowser
            sources={computers.flatMap((computer) =>
                (computer.reportedInventory?.importableSkills ?? []).map((skill) => ({
                    computerId: computer.id,
                    skill,
                }))
            )}
        />
    ),
    stats: ({ server }) => <HostedStatsSettings serverId={server.id} />,
    updates: ({ server }) => (
        <UpdatesSettings computerSettingsHref={serverComputersRoute(server.slug)} />
    ),
};

export function ServerSettingsSectionPage() {
    const { section = 'appearance' } = useParams();
    const { server } = useHostedServerContext();
    const computers = grottoTrpc.computer.list.useQuery(
        { serverId: server.id },
        { enabled: computerBackedSections.has(section) }
    );

    const render = sections[section];
    if (!render) {
        return <Navigate replace to="../appearance" />;
    }
    return render({ computers: computers.data ?? [], server });
}

function MissingComputerSettings({ description, title }: { description: string; title: string }) {
    return (
        <SettingsPage>
            <SettingsPageHeader title={title} />
            <SettingsSection title={title}>
                <SettingsGroup>
                    <SettingsRow description={description} title={`No ${title} available`}>
                        <SettingsValue>Waiting for a Computer</SettingsValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}
