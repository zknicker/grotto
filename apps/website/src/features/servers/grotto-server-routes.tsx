import { Outlet } from 'react-router-dom';
import { GrottoServerProvider } from '../../lib/grotto-server.tsx';

/**
 * Grotto server routes talk straight to the hosted Server, so they run on the
 * hosted client rather than the pre-WS6 local sidecar's.
 */
export function GrottoServerRoutes() {
    return (
        <GrottoServerProvider>
            <Outlet />
        </GrottoServerProvider>
    );
}
