import { Outlet } from 'react-router-dom';
import { GrottoServerProvider } from '../../lib/grotto-server.tsx';
import { SignInGate } from '../auth/sign-in-gate.tsx';
import { HostedServerEventListeners } from './hosted-server-event-listeners.tsx';

/**
 * Grotto server routes talk straight to the hosted Server.
 */
export function GrottoServerRoutes() {
    return (
        <SignInGate>
            <GrottoServerProvider>
                <HostedServerEventListeners />
                <Outlet />
            </GrottoServerProvider>
        </SignInGate>
    );
}
