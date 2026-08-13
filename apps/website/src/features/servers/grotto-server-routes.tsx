import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { GrottoServerProvider, grottoTrpc } from '../../lib/grotto-server.tsx';
import { DevAutoSignIn } from '../auth/dev-auto-sign-in.tsx';
import { SignInGate } from '../auth/sign-in-gate.tsx';
import { ServerEventListeners } from './server-event-listeners.tsx';

/**
 * Grotto server routes talk straight to the hosted Server.
 */
export function GrottoServerRoutes() {
    return (
        <>
            <DevAutoSignIn />
            <SignInGate>
                <GrottoServerProvider>
                    <DevelopmentBootstrap />
                    <ServerEventListeners />
                    <Outlet />
                </GrottoServerProvider>
            </SignInGate>
        </>
    );
}

function DevelopmentBootstrap() {
    const utils = grottoTrpc.useUtils();
    const started = React.useRef(false);
    const bootstrap = grottoTrpc.server.developmentBootstrap.useMutation({
        onSuccess: () => {
            void utils.server.invalidate();
        },
    });

    React.useEffect(() => {
        if (import.meta.env.DEV && !started.current) {
            started.current = true;
            bootstrap.mutate();
        }
    }, [bootstrap.mutate]);

    return null;
}
