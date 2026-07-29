import { useNavigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { ServerChatSearch } from '../../features/servers/server-chat-search.tsx';
import { serverChatRoute } from '../../features/servers/server-routes.ts';
import { ContentTopbar } from '../../features/shell/content-topbar.tsx';

export function ServerSearchPage() {
    const navigate = useNavigate();
    const { server } = useHostedServerContext();
    return (
        <main className="flex h-full min-h-0 flex-col">
            <ContentTopbar>
                <h1 className="shrink-0 font-medium text-sm">Search</h1>
                <span className="truncate text-meta text-muted-foreground">
                    Messages across this Server.
                </span>
            </ContentTopbar>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <ServerChatSearch
                    onOpenChat={(chatId) => navigate(serverChatRoute(server.slug, chatId))}
                    serverId={server.id}
                />
            </div>
        </main>
    );
}
