import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ServerChat } from '../../features/servers/server-chat.tsx';
import { ServerChatSearch } from '../../features/servers/server-chat-search.tsx';
import { serverMembersRoute } from '../../features/servers/server-routes.ts';
import { ServerSwitcher } from '../../features/servers/server-switcher.tsx';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerChatEvents } from '../../hooks/servers/use-server-chat-events.ts';
import { useServerChats } from '../../hooks/servers/use-server-chats.ts';
import { useServerEvents } from '../../hooks/servers/use-server-events.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';

/** One Grotto server opened at `/s/<slug>` with its `#all` Channel. */
export function ServerPage() {
    const { slug = '' } = useParams();
    const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null);
    const server = useServer(slug);
    const servers = useServerList();
    const chats = useServerChats(server.data?.id);

    useServerEvents(server.data?.id);
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

    return (
        <div className="flex h-dvh w-full">
            <aside className="flex w-64 shrink-0 flex-col gap-4 border-border border-r bg-sidebar p-4">
                <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                    Servers
                </p>
                <ServerSwitcher servers={servers.data ?? []} />
                <div className="flex flex-col gap-1">
                    <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                        Chats
                    </p>
                    {chats.data?.map((chat) => {
                        const name =
                            chat.kind === 'channel'
                                ? `#${chat.name}`
                                : `Direct · Human ${chat.peerUserId?.slice(-6) ?? ''}`;

                        return (
                            <Button
                                className="justify-between"
                                key={chat.id}
                                onClick={() => setSelectedChatId(chat.id)}
                                size="sm"
                                variant={chat.id === selectedChat?.id ? 'secondary' : 'ghost'}
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
                </header>
                <ServerChatSearch onOpenChat={setSelectedChatId} serverId={server.data.id} />
                {selectedChat ? (
                    <ServerChat
                        chat={selectedChat}
                        key={selectedChat.id}
                        onOpenChat={setSelectedChatId}
                    />
                ) : null}
            </main>
        </div>
    );
}
