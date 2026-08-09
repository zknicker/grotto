import { Outlet } from 'react-router-dom';
import { GrottoServerProvider } from '../../lib/grotto-server.tsx';

/** Standalone Computer login is public until approval, then authenticates only the approval call. */
export function ComputerLoginRoutes() {
    return (
        <GrottoServerProvider>
            <Outlet />
        </GrottoServerProvider>
    );
}
