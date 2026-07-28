import { useNavigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { ServerChatSearch } from '../../features/servers/server-chat-search.tsx';
import { serverChatRoute } from '../../features/servers/server-routes.ts';

export function ServerSearchPage() {
    const navigate = useNavigate();
    const { server } = useHostedServerContext();
    return (
        <main className="h-full overflow-y-auto">
            <header className="border-border border-b px-6 py-4">
                <h1 className="font-semibold text-lg">Search</h1>
                <p className="text-muted-foreground text-sm">Search messages across this Server.</p>
            </header>
            <ServerChatSearch
                onOpenChat={(chatId) => navigate(serverChatRoute(server.slug, chatId))}
                serverId={server.id}
            />
        </main>
    );
}
