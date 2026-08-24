import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import type { ServerContextValue } from '../../features/servers/server-context.ts';
import { SettingsContentFrame } from '../../features/settings/layout/page.tsx';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

export function ServerSettingsPage() {
    const context = useOutletContext<ServerContextValue>();
    useWindowTitle('Settings');
    const location = useLocation();
    // Skills is the full-bleed library browser; Computers manages its own
    // split layout and scrolling.
    const isFullContentRoute =
        location.pathname.endsWith('/settings/skills') ||
        location.pathname.endsWith('/settings/computers');

    return (
        <SettingsContentFrame isFullContentRoute={isFullContentRoute}>
            <Outlet context={context} />
        </SettingsContentFrame>
    );
}
