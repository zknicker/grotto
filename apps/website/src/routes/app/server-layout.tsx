import { AppLayout } from '@heroui-pro/react';
import * as React from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell, AppShellDragRegion } from '../../components/ui/app-shell.tsx';
import { AgentLifecycleProvider } from '../../features/servers/agent-lifecycle.tsx';
import { ConnectionNotice } from '../../features/servers/connection-notice.tsx';
import { CreateServerDialog } from '../../features/servers/create-server-dialog.tsx';
import { JoinServerDialog } from '../../features/servers/join-server-dialog.tsx';
import {
    readLastChatId,
    rememberLastChatId,
    rememberLastServerSlug,
} from '../../features/servers/server-choice.ts';
import {
    membersRoute,
    serverArchivedChatsRoute,
    serverRoute,
    serverSearchRoute,
    serverSettingsRoute,
} from '../../features/servers/server-routes.ts';
import { AppSidebar } from '../../features/shell/app-sidebar.tsx';
import { CommandMenuProvider } from '../../features/shell/command-menu-provider.tsx';
import { CommandMenu } from '../../features/shell/server-command-menu.tsx';
import { SettingsSidebar } from '../../features/shell/settings-sidebar.tsx';
import { ShellFrame, SidePaneProvider } from '../../features/shell/shell-side-pane.tsx';
import { ShellSidebar, ShellSidebarPage } from '../../features/shell/shell-sidebar.tsx';
import { ShellTopbar, TopbarProvider } from '../../features/shell/shell-topbar.tsx';
import { SidebarAgentActivityStrip } from '../../features/shell/sidebar-agent-activity-strip.tsx';
import {
    SidebarBackToChatRow,
    SidebarServerBand,
} from '../../features/shell/sidebar-server-band.tsx';
import { AgentActivityProvider } from '../../hooks/agents/use-current-agent-activity.tsx';
import { useDesktopDockBadge } from '../../hooks/desktop/use-desktop-dock-badge.ts';
import { useDesktopMenuNavigation } from '../../hooks/desktop/use-desktop-menu-navigation.ts';
import { ChatEventListeners } from '../../hooks/servers/chat-events/chat-event-listeners.tsx';
import { SyncHumanIdentity } from '../../hooks/servers/sync-human-identity.tsx';
import { useChats } from '../../hooks/servers/use-chats.ts';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';
import { useUnfocusableAppMain } from '../../hooks/shell/use-unfocusable-app-main.ts';
import { preloadServerRoutes, preloadServerSection } from './server-route-modules.ts';
import {
    resolveActiveSection,
    resolveChatSectionRoute,
    resolveSelectedChatId,
    resolveSettingsSection,
    resolveSidebarPage,
} from './server-route-state.ts';

export function ServerLayout() {
    const { slug = '' } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const server = useServer(slug);
    const servers = useServerList();
    const chats = useChats(server.data?.id);
    const currentServerSlug = server.data?.slug;
    const selectedChatId = resolveSelectedChatId(location.pathname, slug);
    const [serverDialog, setServerDialog] = React.useState<'create' | 'join' | null>(null);

    useDesktopMenuNavigation({
        searchRoute: serverSearchRoute(slug),
        settingsRoute: serverSettingsRoute(slug),
    });
    useDesktopDockBadge((chats.data ?? []).reduce((total, chat) => total + chat.unreadCount, 0));
    useUnfocusableAppMain();

    React.useEffect(() => {
        if (currentServerSlug) {
            rememberLastServerSlug(currentServerSlug);
        }
    }, [currentServerSlug]);
    React.useEffect(() => {
        if (
            currentServerSlug &&
            selectedChatId &&
            chats.data?.some((chat) => chat.id === selectedChatId)
        ) {
            rememberLastChatId(currentServerSlug, selectedChatId);
        }
    }, [chats.data, currentServerSlug, selectedChatId]);
    React.useEffect(() => {
        if (!currentServerSlug) {
            return;
        }
        if (typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback(preloadServerRoutes, { timeout: 1500 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timeoutId = window.setTimeout(preloadServerRoutes, 250);
        return () => window.clearTimeout(timeoutId);
    }, [currentServerSlug]);

    if (server.error && !server.data) {
        return (
            <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
                <h1 className="font-semibold text-foreground text-lg">Server unavailable</h1>
                <p className="max-w-sm text-muted text-sm">{server.error.message}</p>
            </main>
        );
    }

    if (!server.data) {
        return null;
    }

    const active = resolveActiveSection(location.pathname, slug);
    const settingsSection = resolveSettingsSection(location.pathname, slug);
    const serverChoices = servers.data ?? [server.data];
    const canOperate = server.data.role === 'owner' || server.data.role === 'admin';
    const activeSidebarPage = resolveSidebarPage(active);
    const chatSectionRoute = resolveChatSectionRoute(
        chats.data ?? [],
        selectedChatId ?? readLastChatId(slug),
        slug
    );
    return (
        <SidePaneProvider>
            <TopbarProvider>
                <CommandMenuProvider>
                    <AppShell className="w-full">
                        <ChatEventListeners serverId={server.data.id} />
                        <SyncHumanIdentity serverId={server.data.id} />
                        <AppShellDragRegion />
                        <CommandMenu server={server.data} />
                        <div className="flex min-h-0 flex-1">
                            <AgentLifecycleProvider serverId={server.data.id}>
                                <AgentActivityProvider serverId={server.data.id}>
                                    <AppLayout
                                        className="h-full min-h-0 min-w-0 flex-1"
                                        navigate={navigate}
                                        scrollMode="content"
                                        sidebar={
                                            <ShellSidebar
                                                activePage={activeSidebarPage}
                                                back={
                                                    activeSidebarPage === 'server' ? null : (
                                                        <SidebarBackToChatRow
                                                            route={chatSectionRoute}
                                                        />
                                                    )
                                                }
                                                footer={
                                                    <SidebarAgentActivityStrip
                                                        serverId={server.data.id}
                                                        slug={slug}
                                                    />
                                                }
                                                identity={
                                                    <SidebarServerBand
                                                        currentServer={server.data}
                                                        onCreateServer={() =>
                                                            setServerDialog('create')
                                                        }
                                                        onJoinServer={() => setServerDialog('join')}
                                                        onOpenArchived={() =>
                                                            navigate(serverArchivedChatsRoute(slug))
                                                        }
                                                        onOpenMembers={() =>
                                                            navigate(membersRoute(slug))
                                                        }
                                                        onOpenSettings={() =>
                                                            navigate(serverSettingsRoute(slug))
                                                        }
                                                        onPreloadSettings={() =>
                                                            preloadServerSection('settings')
                                                        }
                                                        onSwitchServer={(serverSlug) =>
                                                            navigate(serverRoute(serverSlug))
                                                        }
                                                        servers={serverChoices}
                                                    />
                                                }
                                            >
                                                <ShellSidebarPage ariaLabel="Server" value="server">
                                                    <AppSidebar
                                                        currentServer={server.data}
                                                        onPreloadSection={preloadServerSection}
                                                        selectedChatId={selectedChatId}
                                                    />
                                                </ShellSidebarPage>
                                                <ShellSidebarPage
                                                    ariaLabel="Settings"
                                                    value="settings"
                                                >
                                                    <SettingsSidebar
                                                        canOperate={canOperate}
                                                        currentSection={settingsSection}
                                                        serverId={server.data.id}
                                                        slug={slug}
                                                    />
                                                </ShellSidebarPage>
                                            </ShellSidebar>
                                        }
                                        sidebarCollapsible="offcanvas"
                                        sidebarOpen
                                        toggleShortcut={false}
                                    >
                                        <ShellFrame>
                                            <ShellTopbar />
                                            <ConnectionNotice
                                                serverError={Boolean(server.error)}
                                                serverId={server.data.id}
                                            />
                                            <Outlet context={{ server: server.data }} />
                                        </ShellFrame>
                                    </AppLayout>
                                </AgentActivityProvider>
                            </AgentLifecycleProvider>
                        </div>
                        <CreateServerDialog
                            isOpen={serverDialog === 'create'}
                            onOpenChange={(isOpen) => setServerDialog(isOpen ? 'create' : null)}
                        />
                        <JoinServerDialog
                            isOpen={serverDialog === 'join'}
                            onOpenChange={(isOpen) => setServerDialog(isOpen ? 'join' : null)}
                        />
                    </AppShell>
                </CommandMenuProvider>
            </TopbarProvider>
        </SidePaneProvider>
    );
}
