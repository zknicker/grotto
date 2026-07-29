import type { HostedComputerInventory } from '@tavern/api';
import * as React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Separator } from '../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../components/ui/settings-row.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import {
    serverBriefVariationsRoute,
    serverComputersRoute,
} from '../../features/servers/server-routes.ts';
import { AppearanceSettings } from '../../features/settings/appearance/page.tsx';
import { HostedBrowserSettingsPage } from '../../features/settings/browser/hosted-page.tsx';
import { ProfileSettings } from '../../features/settings/profile/page.tsx';
import { UpdatesSettings } from '../../features/settings/updates/page.tsx';
import { HostedSkillsBrowser } from '../../features/skills/hosted-skills-browser.tsx';
import { HostedStatsSettings } from '../../features/stats/hosted-stats.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { ServerConnectionsPage } from './server-connections-page.tsx';

export function ServerSettingsSectionPage() {
    const { section = 'agent-runtime' } = useParams();
    const { server } = useHostedServerContext();
    const computers = grottoTrpc.computer.list.useQuery(
        { serverId: server.id },
        {
            enabled: section === 'browser' || section === 'models' || section === 'skills',
        }
    );

    if (section === 'agent-runtime') {
        return <Navigate replace to="../appearance" />;
    }

    if (section === 'appearance') {
        return <AppearanceSettings briefVariationsHref={serverBriefVariationsRoute(server.slug)} />;
    }

    if (section === 'profile') {
        return <ProfileSettings />;
    }

    if (section === 'connections') {
        return <ServerConnectionsPage embedded />;
    }

    if (section === 'stats') {
        return <HostedStatsSettings serverId={server.id} />;
    }

    if (section === 'browser') {
        const computer = computers.data?.find((item) => item.health === 'healthy');
        return computer ? (
            <HostedBrowserSettingsPage computerId={computer.id} serverId={server.id} />
        ) : (
            <MissingComputerSettings
                description="Attach an online Computer to manage its Browser."
                title="Browser"
            />
        );
    }

    if (section === 'models') {
        return <HostedModelsSettings computers={computers.data ?? []} />;
    }

    if (section === 'skills') {
        const sources = (computers.data ?? []).flatMap((computer) =>
            (computer.reportedInventory?.importableSkills ?? []).map((skill) => ({
                computerId: computer.id,
                skill,
            }))
        );
        return <HostedSkillsBrowser sources={sources} />;
    }

    if (section === 'updates') {
        return <UpdatesSettings computerSettingsHref={serverComputersRoute(server.slug)} />;
    }

    return <Navigate replace to="../appearance" />;
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

function HostedModelsSettings({ computers }: { computers: SkillsComputer[] }) {
    const runtimes = computers.flatMap((computer) =>
        (computer.reportedInventory?.runtimes ?? []).map((runtime) => ({
            computerId: computer.id,
            runtime,
        }))
    );

    return (
        <SettingsPage>
            <SettingsPageHeader
                description="Models detected by each attached Computer."
                title="Models"
            />
            <SettingsSection title="Computer Inventory">
                <SettingsGroup>
                    {runtimes.length > 0 ? (
                        runtimes.map(({ computerId, runtime }, index) => (
                            <React.Fragment key={`${computerId}:${runtime.id}`}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsRow
                                    description={`${computerId.slice(-6)} · ${runtime.models
                                        .map((model) => model.label)
                                        .join(', ')}`}
                                    title={runtime.label}
                                >
                                    <SettingsValue>
                                        {runtime.models.length}{' '}
                                        {runtime.models.length === 1 ? 'model' : 'models'}
                                    </SettingsValue>
                                </SettingsRow>
                            </React.Fragment>
                        ))
                    ) : (
                        <SettingsRow
                            description="Attach an online Computer to discover local runtimes and models."
                            title="No models reported"
                        >
                            <SettingsValue>Waiting for a Computer</SettingsValue>
                        </SettingsRow>
                    )}
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

interface SkillsComputer {
    id: string;
    reportedInventory: HostedComputerInventory | null;
}
