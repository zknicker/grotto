import { Outlet, useOutletContext } from 'react-router-dom';
import type { HostedServerContextValue } from '../../features/servers/hosted-server-context.ts';
import { SettingsContentFrame } from '../../features/settings/layout/page.tsx';

export function ServerSettingsPage() {
    const context = useOutletContext<HostedServerContextValue>();

    return (
        <SettingsContentFrame>
            <Outlet context={context} />
        </SettingsContentFrame>
    );
}
