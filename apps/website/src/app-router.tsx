import * as React from 'react';
import {
    createBrowserRouter,
    createHashRouter,
    Navigate,
    useLocation,
    useParams,
} from 'react-router-dom';
import { AppFrame } from './components/app-frame.tsx';
import { ComputerLoginRoutes } from './features/computers/computer-login-routes.tsx';
import { GrottoServerRoutes } from './features/servers/grotto-server-routes.tsx';
import {
    serverRoute,
    settingsAgentRoute,
    settingsHumanRoute,
} from './features/servers/server-routes.ts';
import { isElectronDesktopApp } from './lib/desktop-bridge.ts';
import { serverRouteModules } from './routes/app/server-route-modules.ts';

const ServerErrorPage = React.lazy(async () => {
    const module = await import('./routes/app/server-error-page.tsx');
    return { default: module.ServerErrorPage };
});

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

/** The App is a Server client; Electron supplies only native actions. */
export function createAppRouter() {
    const createRouter = isElectronDesktopApp() ? createHashRouter : createBrowserRouter;
    return createRouter([
        {
            element: <AppFrame />,
            children: [
                ...(import.meta.env.DEV
                    ? [
                          {
                              path: 'prototype/activation/*',
                              lazy: lazyRoute(
                                  () =>
                                      import(
                                          './features/activation-preview/activation-preview-route.tsx'
                                      ),
                                  'ActivationPreviewRoute'
                              ),
                          },
                      ]
                    : []),
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
                                () => import('./features/onboarding/cove-onboarding-route.tsx'),
                                'CoveOnboardingRoute'
                            ),
                            children: [
                                {
                                    lazy: lazyRoute(
                                        () => import('./routes/app/server-layout.tsx'),
                                        'ServerLayout'
                                    ),
                                    children: [
                                        {
                                            errorElement: <ServerErrorBoundary />,
                                            children: [
                                                {
                                                    index: true,
                                                    lazy: lazyRoute(
                                                        serverRouteModules.default,
                                                        'ServerDefaultPage'
                                                    ),
                                                },
                                                {
                                                    path: 'search',
                                                    lazy: lazyRoute(
                                                        serverRouteModules.search,
                                                        'SearchRoute'
                                                    ),
                                                },
                                                {
                                                    path: 'archived',
                                                    lazy: lazyRoute(
                                                        serverRouteModules.archivedChats,
                                                        'ArchivedChatsRoute'
                                                    ),
                                                },
                                                {
                                                    path: 'chats/:chatId',
                                                    lazy: lazyRoute(
                                                        serverRouteModules.chat,
                                                        'ChatRoute'
                                                    ),
                                                },
                                                {
                                                    path: 'dm/:agentId',
                                                    lazy: lazyRoute(
                                                        serverRouteModules.chat,
                                                        'ImplicitAgentDmRoute'
                                                    ),
                                                },
                                                {
                                                    path: 'tasks',
                                                    lazy: lazyRoute(
                                                        serverRouteModules.tasks,
                                                        'TasksPage'
                                                    ),
                                                },
                                                {
                                                    path: 'usage',
                                                    lazy: lazyRoute(
                                                        serverRouteModules.usage,
                                                        'UsagePage'
                                                    ),
                                                },
                                                {
                                                    // The members browser is gone: an Agent or a
                                                    // human is a record under Settings > Members.
                                                    path: 'members/agents/:agentId/*',
                                                    element: <LegacyMemberRedirect kind="agents" />,
                                                },
                                                {
                                                    path: 'members/humans/:userId',
                                                    element: <LegacyMemberRedirect kind="humans" />,
                                                },
                                                {
                                                    // Splat so `/members/humans`
                                                    // and any other stale sub-path
                                                    // land on the directory rather
                                                    // than falling through to the
                                                    // Server's default route.
                                                    path: 'members/*',
                                                    element: (
                                                        <Navigate
                                                            replace
                                                            to="../settings/members"
                                                        />
                                                    ),
                                                },
                                                {
                                                    path: 'computers',
                                                    element: <LegacyComputersRedirect />,
                                                },
                                                {
                                                    path: 'connections',
                                                    element: (
                                                        <Navigate
                                                            replace
                                                            to="../settings/connections"
                                                        />
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
                                                            element: (
                                                                <Navigate replace to="profile" />
                                                            ),
                                                        },
                                                        {
                                                            path: 'members/agents/:agentId',
                                                            element: (
                                                                <Navigate replace to="overview" />
                                                            ),
                                                        },
                                                        {
                                                            path: 'members/agents/:agentId/:tab',
                                                            lazy: lazyRoute(
                                                                serverRouteModules.settingsSection,
                                                                'SettingsAgentRoute'
                                                            ),
                                                        },
                                                        {
                                                            path: 'members/humans/:userId',
                                                            lazy: lazyRoute(
                                                                serverRouteModules.settingsSection,
                                                                'SettingsHumanRoute'
                                                            ),
                                                        },
                                                        {
                                                            path: ':section',
                                                            lazy: lazyRoute(
                                                                serverRouteModules.settingsSection,
                                                                'SettingsSectionRoute'
                                                            ),
                                                        },
                                                    ],
                                                },
                                                {
                                                    path: '*',
                                                    element: <ServerUnknownPage />,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
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
                {
                    element: <ComputerLoginRoutes />,
                    children: [
                        {
                            path: 'computer/login',
                            lazy: lazyRoute(
                                () => import('./routes/app/computer-login-page.tsx'),
                                'ComputerLoginPage'
                            ),
                        },
                    ],
                },
            ],
        },
    ]);
}

/** Computers moved into Settings; keep old deep links (and their ?computer=…) working. */
function LegacyComputersRedirect() {
    const location = useLocation();
    return <Navigate replace to={`../settings/computers${location.search}`} />;
}

/**
 * Members moved into Settings, so an Agent or human deep link keeps working —
 * including the Agent's tab, which is the segment after the id.
 */
function LegacyMemberRedirect({ kind }: { kind: 'agents' | 'humans' }) {
    const { agentId, userId } = useParams();
    const location = useLocation();
    if (kind === 'humans') {
        return (
            <Navigate replace to={settingsHumanRoute(slugFrom(location.pathname), userId ?? '')} />
        );
    }
    const tab = location.pathname.split(`/agents/${agentId}/`)[1]?.split('/')[0];
    return (
        <Navigate
            replace
            to={settingsAgentRoute(slugFrom(location.pathname), agentId ?? '', tab || 'overview')}
        />
    );
}

function slugFrom(pathname: string) {
    return pathname.split('/')[2] ?? '';
}

function ServerUnknownPage() {
    const { slug = '' } = useParams();
    return <Navigate replace to={serverRoute(slug)} />;
}

function ServerErrorBoundary() {
    return (
        <React.Suspense
            fallback={
                <main className="flex min-h-0 flex-1 items-center justify-center text-muted text-sm">
                    Something went wrong…
                </main>
            }
        >
            <ServerErrorPage />
        </React.Suspense>
    );
}
