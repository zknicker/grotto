import * as React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import { HostedServerReminders } from '../../features/servers/reminders/hosted-server-reminders.tsx';
import { ServerChat } from '../../features/servers/server-chat.tsx';
import { ServerChatSearch } from '../../features/servers/server-chat-search.tsx';
import {
    isServerRemindersPath,
    serverAgentsRoute,
    serverComputersRoute,
    serverMembersRoute,
    serverRemindersRoute,
    serverRoute,
} from '../../features/servers/server-routes.ts';
import { ServerSwitcher } from '../../features/servers/server-switcher.tsx';
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
    const agentHandles = new Map((agents.data ?? []).map((agent) => [agent.id, agent.handle]));
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

    return (
        <div className="flex h-dvh w-full">
            <aside className="flex w-64 shrink-0 flex-col gap-4 border-border border-r bg-sidebar p-4">
                <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                    Servers
                </p>
                <ServerSwitcher servers={servers.data ?? []} />
                <div className="flex flex-col gap-1">
                    <Button
                        className="justify-start"
                        onClick={() => {
                            setSurface('tasks');
                            setTaskToOpen(null);
                            navigate(serverRoute(server.data.slug));
                        }}
                        size="sm"
                        variant={!remindersOpen && surface === 'tasks' ? 'secondary' : 'ghost'}
                    >
                        Tasks
                    </Button>
                    <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                        Chats
                    </p>
                    {chats.data?.map((chat) => {
                        const name =
                            chat.kind === 'channel'
                                ? `#${chat.name}`
                                : chat.peerAgentId
                                  ? `Direct · @${agentHandles.get(chat.peerAgentId) ?? 'agent'}`
                                  : `Direct · Human ${chat.peerUserId?.slice(-6) ?? ''}`;

                        return (
                            <Button
                                className="justify-between"
                                key={chat.id}
                                onClick={() => openChat(chat.id)}
                                size="sm"
                                variant={
                                    !remindersOpen &&
                                    surface === 'chat' &&
                                    chat.id === selectedChat?.id
                                        ? 'secondary'
                                        : 'ghost'
                                }
                            >
                                <span>{name}</span>
                                {chat.unreadCount > 0 ? (
                                    <span className="text-muted-foreground text-xs">
                                        {chat.unreadCount}
                                    </span>
                                ) : null}
                            </Button>
                        );
                    })}
                </div>
                {canOperateReminders ? (
                    <div className="flex flex-col gap-1">
                        <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                            Operator
                        </p>
                        <Button
                            className="justify-start"
                            onClick={() => navigate(serverRemindersRoute(server.data.slug))}
                            size="sm"
                            variant={remindersOpen ? 'secondary' : 'ghost'}
                        >
                            Reminders
                        </Button>
                    </div>
                ) : null}
            </aside>
            <main className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-between gap-4 border-border border-b px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                        <h1 className="font-semibold text-base text-foreground">
                            {server.data.displayName}
                        </h1>
                        <p className="text-meta text-muted-foreground">/{server.data.slug}</p>
                    </div>
                    <Link
                        className="text-muted-foreground text-sm hover:text-foreground"
                        to={serverMembersRoute(server.data.slug)}
                    >
                        Members
                    </Link>
                    {canOperateReminders ? (
                        <Link
                            className="text-muted-foreground text-sm hover:text-foreground"
                            to={serverAgentsRoute(server.data.slug)}
                        >
                            Agents
                        </Link>
                    ) : null}
                    {canOperateReminders ? (
                        <Link
                            className="text-muted-foreground text-sm hover:text-foreground"
                            to={serverComputersRoute(server.data.slug)}
                        >
                            Computers
                        </Link>
                    ) : null}
                </header>
                {remindersOpen && canOperateReminders ? (
                    <HostedServerReminders serverId={server.data.id} />
                ) : remindersOpen ? (
                    <div className="grid flex-1 place-content-center gap-1 px-6 text-center">
                        <h2 className="font-medium text-foreground">Owner or Admin required</h2>
                        <p className="max-w-sm text-muted-foreground text-sm">
                            Reminder schedules and fire logs are available only to Server operators.
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
                        <ServerChatSearch onOpenChat={openChat} serverId={server.data.id} />
                        {selectedChat ? (
                            <ServerChat
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
                            />
                        ) : null}
                    </>
                )}
            </main>
        </div>
    );
}
