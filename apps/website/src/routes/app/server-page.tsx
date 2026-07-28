import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    AppShell,
    AppShellBody,
    AppShellDragRegion,
    AppShellMain,
} from '../../components/ui/app-shell.tsx';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';
import {
    HostedServerRail,
    type HostedServerSection,
} from '../../features/servers/hosted-server-rail.tsx';
import { HostedServerSidebar } from '../../features/servers/hosted-server-sidebar.tsx';
import { HostedServerReminders } from '../../features/servers/reminders/hosted-server-reminders.tsx';
import { ServerChat } from '../../features/servers/server-chat.tsx';
import { ServerChatSearch } from '../../features/servers/server-chat-search.tsx';
import {
    isServerRemindersPath,
    serverMembersRoute,
    serverRemindersRoute,
    serverRoute,
    serverSettingsRoute,
} from '../../features/servers/server-routes.ts';
import type { ServerTask } from '../../features/servers/tasks/server-task-presentation.ts';
import { ServerTasksSurface } from '../../features/servers/tasks/server-tasks-surface.tsx';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerChatEvents } from '../../hooks/servers/use-server-chat-events.ts';
import { useServerChats } from '../../hooks/servers/use-server-chats.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** One Grotto server opened at `/s/<slug>` with its `#all` Channel. */
export function ServerPage() {
    const { slug = '' } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null);
    const [surface, setSurface] = React.useState<'chat' | 'tasks'>('chat');
    const [taskToOpen, setTaskToOpen] = React.useState<ServerTask | null>(null);
    const server = useServer(slug);
    const servers = useServerList();
    const chats = useServerChats(server.data?.id);
    const agents = grottoTrpc.agent.list.useQuery(
        { serverId: server.data?.id ?? '' },
        { enabled: Boolean(server.data) }
    );
    const remindersOpen = isServerRemindersPath(location.pathname, slug);

    useServerChatEvents(server.data?.id);

    if (server.error) {
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

    const selectedChat =
        chats.data?.find((chat) => chat.id === selectedChatId) ??
        chats.data?.find((chat) => chat.isAll) ??
        chats.data?.[0];
    const selectedTask = taskToOpen?.message.serverId === server.data.id ? taskToOpen : null;
    const canOperateReminders = server.data.role === 'owner' || server.data.role === 'admin';
    const openChat = (chatId: string) => {
        setSelectedChatId(chatId);
        setSurface('chat');
        setTaskToOpen(null);
        navigate(serverRoute(server.data.slug));
    };
    const activeSection: HostedServerSection = remindersOpen ? 'reminders' : surface;
    const selectSection = (section: HostedServerSection) => {
        if (section === 'tasks') {
            setSurface('tasks');
            setTaskToOpen(null);
            navigate(serverRoute(server.data.slug));
            return;
        }
        if (section === 'chat') {
            setSurface('chat');
            navigate(serverRoute(server.data.slug));
            return;
        }
        if (section === 'reminders') {
            navigate(serverRemindersRoute(server.data.slug));
            return;
        }
        navigate(
            section === 'members'
                ? serverMembersRoute(server.data.slug)
                : serverSettingsRoute(server.data.slug)
        );
    };

    return (
        <SidebarProvider className="app-reference-theme flex min-h-screen w-full md:h-dvh md:min-h-0">
            <AppShell className="w-full" data-app-layout="sidebar">
                <AppShellDragRegion />
                <AppShellBody className="pt-0 md:flex-row">
                    <HostedServerRail
                        active={activeSection}
                        canOperate={canOperateReminders}
                        onSelect={selectSection}
                    />
                    <HostedServerSidebar
                        agents={agents.data ?? []}
                        chats={chats.data ?? []}
                        currentServer={server.data}
                        onOpenActivity={() => navigate(serverRoute(server.data.slug))}
                        onOpenChat={openChat}
                        selectedChatId={
                            !remindersOpen && surface === 'chat' ? selectedChat?.id : undefined
                        }
                        servers={servers.data ?? [server.data]}
                    />
                    <AppShellMain data-edge-to-edge="true">
                        <main className="flex h-full min-w-0 flex-1 flex-col">
                            <header className="flex h-[var(--topbar-height)] items-center justify-between gap-4 border-border border-b px-6">
                                <div className="flex flex-col gap-0.5">
                                    <h1 className="font-semibold text-base text-foreground">
                                        {server.data.displayName}
                                    </h1>
                                    <p className="text-meta text-muted-foreground">
                                        /{server.data.slug}
                                    </p>
                                </div>
                                <span className="text-muted-foreground text-xs">
                                    {agents.data?.length ?? 0} Agents
                                </span>
                            </header>
                            {remindersOpen && canOperateReminders ? (
                                <HostedServerReminders serverId={server.data.id} />
                            ) : remindersOpen ? (
                                <div className="grid flex-1 place-content-center gap-1 px-6 text-center">
                                    <h2 className="font-medium text-foreground">
                                        Owner or Admin required
                                    </h2>
                                    <p className="max-w-sm text-muted-foreground text-sm">
                                        Reminder schedules and fire logs are available only to
                                        Server operators.
                                    </p>
                                </div>
                            ) : surface === 'tasks' ? (
                                <ServerTasksSurface
                                    chats={chats.data ?? []}
                                    onOpenTask={(task) => {
                                        setSelectedChatId(task.chatId);
                                        setTaskToOpen(task);
                                        setSurface('chat');
                                    }}
                                    role={server.data.role}
                                    serverId={server.data.id}
                                    viewerUserId={server.data.viewerUserId}
                                />
                            ) : (
                                <>
                                    <ServerChatSearch
                                        onOpenChat={openChat}
                                        serverId={server.data.id}
                                    />
                                    {selectedChat ? (
                                        <ServerChat
                                            agents={agents.data ?? []}
                                            chat={selectedChat}
                                            initialTask={
                                                selectedTask
                                                    ? {
                                                          message: selectedTask.message,
                                                          summary: selectedTask.threadSummary,
                                                          threadChatId: selectedTask.threadChatId,
                                                      }
                                                    : undefined
                                            }
                                            key={`${selectedChat.id}:${selectedTask?.id ?? ''}`}
                                            onOpenChat={openChat}
                                            role={server.data.role}
                                            server={server.data}
                                            viewerUserId={server.data.viewerUserId}
                                        />
                                    ) : null}
                                </>
                            )}
                        </main>
                    </AppShellMain>
                </AppShellBody>
            </AppShell>
        </SidebarProvider>
    );
}
