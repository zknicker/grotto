import { Outlet } from 'react-router-dom';
import { HausServerProvider } from '../../lib/haus-server.tsx';

/** Standalone Computer login is public until approval, then authenticates only the approval call. */
export function ComputerLoginRoutes() {
    return (
        <HausServerProvider>
            <Outlet />
        </HausServerProvider>
    );
}
