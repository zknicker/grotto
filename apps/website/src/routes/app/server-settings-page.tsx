import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import type { ServerContextValue } from '../../features/servers/server-context.ts';
import { SettingsContentFrame } from '../../features/settings/layout/page.tsx';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

export function ServerSettingsPage() {
    const context = useOutletContext<ServerContextValue>();
    useWindowTitle('Settings');
    const location = useLocation();
    const isSkillsRoute = location.pathname.endsWith('/settings/skills');

    return (
        <SettingsContentFrame isFullContentRoute={isSkillsRoute}>
            <Outlet context={context} />
        </SettingsContentFrame>
    );
}
