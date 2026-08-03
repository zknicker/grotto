import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';
import { AppFrame } from './components/app-frame.tsx';
import { GrottoServerRoutes } from './features/servers/grotto-server-routes.tsx';
import { isElectronDesktopApp } from './lib/desktop-bridge.ts';
import { serverRouteModules } from './routes/app/server-route-modules.ts';

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
                                () => import('./routes/app/server-layout.tsx'),
                                'ServerLayout'
                            ),
                            children: [
                                {
                                    index: true,
                                    lazy: lazyRoute(
                                        serverRouteModules.default,
                                        'ServerDefaultPage'
                                    ),
                                },
                                {
                                    path: 'activity',
                                    lazy: lazyRoute(
                                        serverRouteModules.activity,
                                        'ServerActivityPage'
                                    ),
                                },
                                {
                                    path: 'search',
                                    lazy: lazyRoute(serverRouteModules.search, 'ServerSearchPage'),
                                },
                                {
                                    path: 'design/brief',
                                    lazy: lazyRoute(
                                        serverRouteModules.brief,
                                        'ServerBriefVariationsPage'
                                    ),
                                },
                                {
                                    path: 'chats/:chatId',
                                    lazy: lazyRoute(serverRouteModules.chat, 'ServerChatPage'),
                                },
                                {
                                    path: 'tasks',
                                    lazy: lazyRoute(serverRouteModules.tasks, 'ServerTasksPage'),
                                },
                                {
                                    path: 'reminders',
                                    lazy: lazyRoute(
                                        serverRouteModules.reminders,
                                        'ServerRemindersPage'
                                    ),
                                },
                                {
                                    path: 'members',
                                    lazy: lazyRoute(
                                        serverRouteModules.members,
                                        'ServerMembersPage'
                                    ),
                                },
                                {
                                    path: 'members/agents/:agentId',
                                    lazy: lazyRoute(
                                        serverRouteModules.members,
                                        'ServerMembersPage'
                                    ),
                                },
                                {
                                    path: 'members/humans',
                                    lazy: lazyRoute(
                                        serverRouteModules.members,
                                        'ServerMembersPage'
                                    ),
                                },
                                {
                                    path: 'members/humans/:userId',
                                    lazy: lazyRoute(
                                        serverRouteModules.members,
                                        'ServerMembersPage'
                                    ),
                                },
                                {
                                    path: 'computers',
                                    lazy: lazyRoute(
                                        serverRouteModules.computers,
                                        'ServerComputersPage'
                                    ),
                                },
                                {
                                    path: 'settings',
                                    lazy: lazyRoute(
                                        serverRouteModules.settings,
                                        'ServerSettingsPage'
                                    ),
                                    children: [
                                        {
                                            index: true,
                                            element: <Navigate replace to="appearance" />,
                                        },
                                        {
                                            path: ':section',
                                            lazy: lazyRoute(
                                                serverRouteModules.settingsSection,
                                                'ServerSettingsSectionPage'
                                            ),
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            path: 's/:slug/connections',
                            lazy: lazyRoute(
                                () => import('./routes/app/server-connections-page.tsx'),
                                'ServerConnectionsPage'
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
