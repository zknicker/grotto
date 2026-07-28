import * as React from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    AppShell,
    AppShellBody,
    AppShellDragRegion,
    AppShellMain,
} from '../../components/ui/app-shell.tsx';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';
import type { HostedServerSection } from '../../features/servers/hosted-server-rail.tsx';
import { HostedServerRail } from '../../features/servers/hosted-server-rail.tsx';
import { HostedServerSettingsNav } from '../../features/servers/hosted-server-settings-nav.tsx';
import { HostedServerSidebar } from '../../features/servers/hosted-server-sidebar.tsx';
import { rememberLastServerSlug } from '../../features/servers/server-choice.ts';
import {
    serverActivityRoute,
    serverChatRoute,
    serverComputersRoute,
    serverMembersRoute,
    serverRemindersRoute,
    serverRoute,
    serverSearchRoute,
    serverSettingsRoute,
    serverTasksRoute,
} from '../../features/servers/server-routes.ts';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerChatEvents } from '../../hooks/servers/use-server-chat-events.ts';
import { useServerChats } from '../../hooks/servers/use-server-chats.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';
import { grottoTrpc, useGrottoServerConnectionState } from '../../lib/grotto-server.tsx';

export function ServerLayout() {
    const { slug = '' } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const server = useServer(slug);
    const servers = useServerList();
    const chats = useServerChats(server.data?.id);
    const agents = grottoTrpc.agent.list.useQuery(
        { serverId: server.data?.id ?? '' },
        { enabled: Boolean(server.data) }
    );
    const connectionState = useGrottoServerConnectionState();
    const currentServerSlug = server.data?.slug;

    useServerChatEvents(server.data?.id);
    React.useEffect(() => {
        if (currentServerSlug) {
            rememberLastServerSlug(currentServerSlug);
        }
    }, [currentServerSlug]);

    if (server.error && !server.data) {
        return (
            <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
                <h1 className="font-semibold text-foreground text-lg">Server unavailable</h1>
                <p className="max-w-sm text-muted-foreground text-sm">{server.error.message}</p>
            </main>
        );
    }

    if (!server.data) {
        return null;
    }

    const active = resolveActiveSection(location.pathname, slug);
    const selectedChatId = resolveSelectedChatId(location.pathname, slug);
    const serverChoices = servers.data ?? [server.data];
    const openChat = (chatId: string) => navigate(serverChatRoute(slug, chatId));
    const selectSection = (section: HostedServerSection) => {
        const route = {
            activity: serverActivityRoute(slug),
            chat: selectedChatId
                ? serverChatRoute(slug, selectedChatId)
                : serverChatRoute(
                      slug,
                      chats.data?.find((chat) => chat.isAll)?.id ?? chats.data?.[0]?.id ?? ''
                  ),
            computers: serverComputersRoute(slug),
            members: serverMembersRoute(slug),
            reminders: serverRemindersRoute(slug),
            search: serverSearchRoute(slug),
            settings: serverSettingsRoute(slug),
            tasks: serverTasksRoute(slug),
        }[section];
        navigate(route);
    };

    return (
        <SidebarProvider className="app-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0">
            <AppShell className="w-full" data-app-layout="sidebar">
                <AppShellDragRegion />
                <AppShellBody className="pt-0 md:flex-row">
                    <HostedServerRail
                        active={active}
                        canOperate={server.data.role === 'owner' || server.data.role === 'admin'}
                        onSelect={selectSection}
                    />
                    {active === 'members' || active === 'computers' ? null : active ===
                      'settings' ? (
                        <HostedServerSettingsNav
                            currentServer={server.data}
                            servers={serverChoices}
                        />
                    ) : (
                        <HostedServerSidebar
                            agents={agents.data ?? []}
                            chats={chats.data ?? []}
                            currentServer={server.data}
                            onOpenActivity={() => navigate(serverActivityRoute(slug))}
                            onOpenChat={openChat}
                            selectedChatId={selectedChatId}
                            servers={serverChoices}
                        />
                    )}
                    <AppShellMain
                        data-edge-to-edge="true"
                        data-rail-flush={
                            active === 'members' || active === 'computers' ? 'true' : undefined
                        }
                    >
                        {server.error || connectionState !== 'connected' ? (
                            <div className="absolute top-2 right-3 z-20 rounded-md border border-border bg-background/95 px-2 py-1 text-muted-foreground text-xs shadow-sm">
                                Server reconnecting · showing the latest data
                            </div>
                        ) : null}
                        <Outlet
                            context={{
                                agents: agents.data ?? [],
                                chats: chats.data ?? [],
                                server: server.data,
                                servers: servers.data ?? [],
                            }}
                        />
                    </AppShellMain>
                </AppShellBody>
            </AppShell>
        </SidebarProvider>
    );
}

function resolveActiveSection(pathname: string, slug: string): HostedServerSection {
    const suffix = pathname.slice(serverRoute(slug).length);
    if (suffix.startsWith('/design/brief')) {
        return 'settings';
    }
    if (suffix.startsWith('/activity')) {
        return 'activity';
    }
    if (suffix.startsWith('/members')) {
        return 'members';
    }
    if (suffix.startsWith('/agents')) {
        return 'members';
    }
    if (suffix.startsWith('/computers')) {
        return 'computers';
    }
    if (suffix.startsWith('/reminders')) {
        return 'reminders';
    }
    if (suffix.startsWith('/settings')) {
        return 'settings';
    }
    if (suffix.startsWith('/tasks')) {
        return 'tasks';
    }
    if (suffix.startsWith('/search')) {
        return 'search';
    }
    return 'chat';
}

function resolveSelectedChatId(pathname: string, slug: string) {
    const prefix = `${serverRoute(slug)}/chats/`;
    return pathname.startsWith(prefix)
        ? decodeURIComponent(pathname.slice(prefix.length))
        : undefined;
}
