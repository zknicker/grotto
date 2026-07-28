import { Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Navigate } from 'react-router-dom';
import {
    AppShell,
    AppShellBody,
    AppShellDragRegion,
    AppShellMain,
} from '../../components/ui/app-shell.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';
import { HostedServerChooser } from '../../features/servers/hosted-server-chooser.tsx';
import { readLastServerSlug, resolveEntryServer } from '../../features/servers/server-choice.ts';
import { ServerChoicePanel } from '../../features/servers/server-choice-panel.tsx';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { AppIconRailView } from '../../features/shell/app-icon-rail.tsx';
import { AppSidebarFrame } from '../../features/shell/sidebar.tsx';
import { SidebarAuthItems } from '../../features/shell/sidebar-auth-items.tsx';
import { useServerList } from '../../hooks/servers/use-server-list.ts';

/** Resolves signed-in entry to a joined Server; only the empty state remains here. */
export function ServersPage() {
    const servers = useServerList();

    if (!servers.data && servers.error) {
        return (
            <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
                <h1 className="font-semibold text-foreground text-lg">Servers unavailable</h1>
                <p className="max-w-sm text-muted-foreground text-sm">{servers.error.message}</p>
            </main>
        );
    }

    if (!servers.data) {
        return null;
    }

    const entryServer = resolveEntryServer(servers.data, readLastServerSlug());
    if (entryServer) {
        return <Navigate replace to={serverRoute(entryServer.slug)} />;
    }

    return <EmptyServerShell />;
}

function EmptyServerShell() {
    return (
        <SidebarProvider className="app-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0">
            <AppShell className="w-full" data-app-layout="sidebar">
                <AppShellDragRegion />
                <AppShellBody className="pt-0 md:flex-row">
                    <AppIconRailView
                        items={[]}
                        settings={{
                            content: (
                                <Icon
                                    aria-hidden="true"
                                    className="size-4.5"
                                    icon={Setting07Icon}
                                    size={20}
                                />
                            ),
                            disabled: true,
                            id: 'settings',
                            isActive: false,
                            label: 'Settings require a Server',
                            onClick: () => undefined,
                        }}
                    />
                    <AppSidebarFrame
                        content={<HostedServerChooser currentServer={null} servers={[]} />}
                        footer={<SidebarAuthItems />}
                    />
                    <AppShellMain data-edge-to-edge="true">
                        <main className="min-h-0 flex-1 overflow-y-auto">
                            <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-16">
                                <header className="flex flex-col gap-2">
                                    <h1 className="font-display text-2xl text-foreground">
                                        Your first Server
                                    </h1>
                                    <p className="text-muted-foreground text-sm">
                                        Create a Server or join one with an invitation.
                                    </p>
                                </header>
                                <ServerChoicePanel servers={[]} />
                            </div>
                        </main>
                    </AppShellMain>
                </AppShellBody>
            </AppShell>
        </SidebarProvider>
    );
}
