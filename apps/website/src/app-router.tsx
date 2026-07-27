import { createBrowserRouter, createHashRouter } from 'react-router-dom';
import { AppFrame } from './components/app-frame.tsx';
import { GrottoServerRoutes } from './features/servers/grotto-server-routes.tsx';
import { isElectronDesktopApp } from './lib/desktop-bridge.ts';

function lazyRoute<TModule extends Record<string, unknown>>(
    load: () => Promise<TModule>,
    exportName: keyof TModule
) {
    return async () => {
        const module = await load();
        const Component = module[exportName];
        if (typeof Component !== 'function') {
            throw new Error(`Route export "${String(exportName)}" is not a component.`);
        }
        return { Component };
    };
}

/** The App is a hosted Server client; Electron supplies only native actions. */
export function createAppRouter() {
    const createRouter = isElectronDesktopApp() ? createHashRouter : createBrowserRouter;
    return createRouter([
        {
            element: <AppFrame />,
            children: [
                {
                    element: <GrottoServerRoutes />,
                    children: [
                        {
                            index: true,
                            lazy: lazyRoute(
                                () => import('./routes/app/servers-page.tsx'),
                                'ServersPage'
                            ),
                        },
                        {
                            path: 's',
                            lazy: lazyRoute(
                                () => import('./routes/app/servers-page.tsx'),
                                'ServersPage'
                            ),
                        },
                        {
                            path: 's/:slug',
                            lazy: lazyRoute(
                                () => import('./routes/app/server-page.tsx'),
                                'ServerPage'
                            ),
                        },
                        {
                            path: 's/:slug/members',
                            lazy: lazyRoute(
                                () => import('./routes/app/server-members-page.tsx'),
                                'ServerMembersPage'
                            ),
                        },
                        {
                            path: 's/:slug/computers',
                            lazy: lazyRoute(
                                () => import('./routes/app/server-computers-page.tsx'),
                                'ServerComputersPage'
                            ),
                        },
                        {
                            path: 's/:slug/connections',
                            lazy: lazyRoute(
                                () => import('./routes/app/server-connections-page.tsx'),
                                'ServerConnectionsPage'
                            ),
                        },
                        {
                            path: 's/:slug/agents',
                            lazy: lazyRoute(
                                () => import('./routes/app/server-agents-page.tsx'),
                                'ServerAgentsPage'
                            ),
                        },
                        {
                            path: 's/:slug/reminders',
                            lazy: lazyRoute(
                                () => import('./routes/app/server-page.tsx'),
                                'ServerPage'
                            ),
                        },
                        {
                            path: 'computer/approve',
                            lazy: lazyRoute(
                                () => import('./routes/app/computer-approval-page.tsx'),
                                'ComputerApprovalPage'
                            ),
                        },
                        {
                            path: 'invite/:token',
                            lazy: lazyRoute(
                                () => import('./routes/app/accept-invitation-page.tsx'),
                                'AcceptInvitationPage'
                            ),
                        },
                    ],
                },
            ],
        },
    ]);
}
