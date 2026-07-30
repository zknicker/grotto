import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';
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
                                () => import('./routes/app/server-layout.tsx'),
                                'ServerLayout'
                            ),
                            children: [
                                {
                                    index: true,
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-default-page.tsx'),
                                        'ServerDefaultPage'
                                    ),
                                },
                                {
                                    path: 'activity',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-activity-page.tsx'),
                                        'ServerActivityPage'
                                    ),
                                },
                                {
                                    path: 'search',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-search-page.tsx'),
                                        'ServerSearchPage'
                                    ),
                                },
                                {
                                    path: 'design/brief',
                                    lazy: lazyRoute(
                                        () =>
                                            import('./routes/app/server-brief-variations-page.tsx'),
                                        'ServerBriefVariationsPage'
                                    ),
                                },
                                {
                                    path: 'chats/:chatId',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-chat-page.tsx'),
                                        'ServerChatPage'
                                    ),
                                },
                                {
                                    path: 'tasks',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-tasks-page.tsx'),
                                        'ServerTasksPage'
                                    ),
                                },
                                {
                                    path: 'reminders',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-reminders-page.tsx'),
                                        'ServerRemindersPage'
                                    ),
                                },
                                {
                                    path: 'members',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-members-page.tsx'),
                                        'ServerMembersPage'
                                    ),
                                },
                                {
                                    path: 'members/agents/:agentId',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-members-page.tsx'),
                                        'ServerMembersPage'
                                    ),
                                },
                                {
                                    path: 'members/humans',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-members-page.tsx'),
                                        'ServerMembersPage'
                                    ),
                                },
                                {
                                    path: 'computers',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-computers-page.tsx'),
                                        'ServerComputersPage'
                                    ),
                                },
                                {
                                    path: 'settings',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-settings-page.tsx'),
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
                                                () =>
                                                    import(
                                                        './routes/app/server-settings-section-page.tsx'
                                                    ),
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
