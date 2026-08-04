import { Navigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { readLastChatId, resolveEntryChat } from '../../features/servers/server-choice.ts';
import { serverChatRoute } from '../../features/servers/server-routes.ts';

export function ServerDefaultPage() {
    const { chatListStatus, chats, server } = useHostedServerContext();

    if (chatListStatus === 'loading') {
        return null;
    }

    const chat = resolveEntryChat(chats, readLastChatId(server.slug));
    if (!chat) {
        return (
            <main className="flex h-full items-center justify-center px-6 text-center">
                <div>
                    <h1 className="font-semibold text-foreground text-lg">No Chats yet</h1>
                    <p className="mt-1 text-muted text-sm">
                        Create a Channel from the sidebar to begin.
                    </p>
                </div>
            </main>
        );
    }

    return <Navigate replace to={serverChatRoute(server.slug, chat.id)} />;
}
