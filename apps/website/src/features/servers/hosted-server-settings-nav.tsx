import { useNavigate } from 'react-router-dom';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { SettingsSidebarNavView } from '../settings/layout/sidebar-nav.tsx';
import { AppSidebarFrame } from '../shell/sidebar.tsx';
import { HostedServerChooser } from './hosted-server-chooser.tsx';
import { serverActivityRoute, serverSettingsSectionRoute } from './server-routes.ts';

const hostedHiddenSettings = new Set(['agent-runtime'] as const);

export function HostedServerSettingsNav({
    currentServer,
    servers,
}: {
    currentServer: ServerSummary;
    servers: ServerSummary[];
}) {
    const navigate = useNavigate();
    const slug = currentServer.slug;

    return (
        <AppSidebarFrame
            content={
                <>
                    <HostedServerChooser currentServer={currentServer} servers={servers} />
                    <SettingsSidebarNavView
                        hiddenItemIds={hostedHiddenSettings}
                        onBackToApp={() => navigate(serverActivityRoute(slug))}
                        resolveTo={(_, item) => serverSettingsSectionRoute(slug, item.id)}
                    />
                </>
            }
        />
    );
}
