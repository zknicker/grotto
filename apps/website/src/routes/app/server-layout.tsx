import { AppLayout } from '@heroui-pro/react';
import * as React from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell, AppShellDragRegion } from '../../components/ui/app-shell.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { type ChannelAgentOption, ChannelDialog } from '../../features/chats/channel-dialog.tsx';
import { rememberLastServerSlug } from '../../features/servers/server-choice.ts';
import { ServerChoicePanel } from '../../features/servers/server-choice-panel.tsx';
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
import { ServerTasksSidebar } from '../../features/servers/tasks/server-tasks-sidebar.tsx';
import type { SettingsRouteTab } from '../../features/settings/layout/navigation.ts';
import { AppRail, type AppRailSection } from '../../features/shell/app-rail.tsx';
import { AppSidebar } from '../../features/shell/app-sidebar.tsx';
import { HostedCommandMenu } from '../../features/shell/hosted-command-menu.tsx';
import { SettingsSidebar } from '../../features/shell/settings-sidebar.tsx';
import { useCreateServerChannel } from '../../hooks/servers/use-create-server-channel.ts';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerAgentLifecycle } from '../../hooks/servers/use-server-agent-lifecycle.ts';
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
    const createChannel = useCreateServerChannel();
    const agents = grottoTrpc.agent.list.useQuery(
        { serverId: server.data?.id ?? '' },
        { enabled: Boolean(server.data) }
    );
    const connectionState = useGrottoServerConnectionState();
    const currentServerSlug = server.data?.slug;
    const [creatingChannel, setCreatingChannel] = React.useState(false);
    const [managingServers, setManagingServers] = React.useState(false);
    const agentLifecycles = useServerAgentLifecycle(server.data?.id);

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
                <p className="max-w-sm text-muted text-sm">{server.error.message}</p>
            </main>
        );
    }

    if (!server.data) {
        return null;
    }

    const active = resolveActiveSection(location.pathname, slug);
    const selectedChatId = resolveSelectedChatId(location.pathname, slug);
    const settingsSection = resolveSettingsSection(location.pathname, slug);
    const agentListStatus = agents.data ? 'ready' : agents.isPending ? 'loading' : 'error';
    const chatListStatus = chats.data ? 'ready' : chats.isPending ? 'loading' : 'error';
    const serverChoices = servers.data ?? [server.data];
    const channelAgents: ChannelAgentOption[] = (agents.data ?? []).map((agent) => ({
        effectiveCharacter: agent.character,
        effectivePrimaryColor: null,
        id: agent.id,
        name: agent.displayName,
    }));
    const showSidebar = active !== 'members' && active !== 'computers';
    const openChat = (chatId: string) => navigate(serverChatRoute(slug, chatId));
    const selectSection = (section: AppRailSection) => {
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
        <AppShell className="w-full">
            <AppShellDragRegion />
            <HostedCommandMenu
                agents={agents.data ?? []}
                chats={chats.data ?? []}
                role={server.data.role}
                serverSlug={slug}
            />
            <div className="flex min-h-0 flex-1">
                <AppRail
                    active={active}
                    canOperate={server.data.role === 'owner' || server.data.role === 'admin'}
                    currentServer={server.data}
                    onManageServers={() => setManagingServers(true)}
                    onSelect={selectSection}
                    onSwitchServer={(serverSlug) => navigate(serverRoute(serverSlug))}
                    servers={serverChoices}
                />
                <AppLayout
                    className="h-full min-h-0 min-w-0 flex-1"
                    navigate={navigate}
                    scrollMode="content"
                    sidebar={
                        active === 'settings' ? (
                            <SettingsSidebar currentSection={settingsSection} slug={slug} />
                        ) : active === 'tasks' ? (
                            <ServerTasksSidebar serverId={server.data.id} slug={slug} />
                        ) : (
                            <AppSidebar
                                agents={agents.data ?? []}
                                chats={chats.data ?? []}
                                currentServer={server.data}
                                onCreateChannel={() => {
                                    createChannel.reset();
                                    setCreatingChannel(true);
                                }}
                                selectedChatId={selectedChatId}
                            />
                        )
                    }
                    sidebarCollapsible="offcanvas"
                    sidebarOpen={showSidebar}
                    toggleShortcut={false}
                >
                    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                        {server.error || agents.error || connectionState !== 'connected' ? (
                            <div className="absolute top-2 right-3 z-20 rounded-lg bg-surface-secondary px-2 py-1 text-muted text-xs shadow-surface">
                                {agents.error && !agents.data
                                    ? 'Agent directory unavailable'
                                    : 'Server reconnecting · showing the latest data'}
                            </div>
                        ) : null}
                        <Outlet
                            context={{
                                agentListStatus,
                                agentLifecycles,
                                agents: agents.data ?? [],
                                chatListStatus,
                                chats: chats.data ?? [],
                                server: server.data,
                                servers: servers.data ?? [],
                            }}
                        />
                    </div>
                </AppLayout>
            </div>
            <ChannelDialog
                agents={channelAgents}
                agentsPending={agents.isPending}
                errorMessage={createChannel.error?.message ?? null}
                initialAgentIds={[]}
                initialDisplayName=""
                isPending={createChannel.isPending}
                onClose={() => {
                    createChannel.reset();
                    setCreatingChannel(false);
                }}
                onSubmit={async ({ agentIds, displayName }) => {
                    const channel = await createChannel.mutateAsync({
                        agentIds,
                        name: displayName,
                        serverId: server.data.id,
                    });
                    setCreatingChannel(false);
                    openChat(channel.id);
                }}
                open={creatingChannel}
                submitLabel="Create"
                title="New channel"
            />
            <Dialog onOpenChange={setManagingServers} open={managingServers}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Servers</DialogTitle>
                        <DialogDescription>
                            Switch to a joined Server, create one, or accept an invitation.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel className="overflow-y-auto">
                        <ServerChoicePanel
                            onServerSelect={() => setManagingServers(false)}
                            servers={serverChoices}
                        />
                    </DialogPanel>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
}

function resolveActiveSection(pathname: string, slug: string): AppRailSection {
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

function resolveSettingsSection(pathname: string, slug: string): SettingsRouteTab | undefined {
    const prefix = `${serverSettingsRoute(slug)}/`;
    if (!pathname.startsWith(prefix)) {
        return undefined;
    }
    const section = decodeURIComponent(pathname.slice(prefix.length)).split('/')[0];
    return section ? (section as SettingsRouteTab) : undefined;
}
