import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import type { HostedServerContextValue } from '../../features/servers/hosted-server-context.ts';
import { SettingsContentFrame } from '../../features/settings/layout/page.tsx';

export function ServerSettingsPage() {
    const context = useOutletContext<HostedServerContextValue>();
    const location = useLocation();
    const isSkillsRoute = location.pathname.endsWith('/settings/skills');

    return (
        <SettingsContentFrame isFullContentRoute={isSkillsRoute}>
            <Outlet context={context} />
        </SettingsContentFrame>
    );
}
