import { Outlet } from 'react-router-dom';
import { GrottoServerProvider } from '../../lib/grotto-server.tsx';
import { SignInGate } from '../auth/sign-in-gate.tsx';

/**
 * Grotto server routes talk straight to the hosted Server, so they run on the
 * hosted client rather than the pre-WS6 local sidecar's.
 */
export function GrottoServerRoutes() {
    return (
        <SignInGate>
            <GrottoServerProvider>
                <Outlet />
            </GrottoServerProvider>
        </SignInGate>
    );
}
