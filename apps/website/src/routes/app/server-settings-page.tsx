import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import type { HostedServerContextValue } from '../../features/servers/hosted-server-context.ts';
import { SettingsContentFrame } from '../../features/settings/layout/page.tsx';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

export function ServerSettingsPage() {
    const context = useOutletContext<HostedServerContextValue>();
    useWindowTitle('Settings');
    const location = useLocation();
    const isSkillsRoute = location.pathname.endsWith('/settings/skills');

    return (
        <SettingsContentFrame isFullContentRoute={isSkillsRoute}>
            <Outlet context={context} />
        </SettingsContentFrame>
    );
}
