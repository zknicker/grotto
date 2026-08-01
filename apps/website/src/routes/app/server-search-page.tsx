import { useNavigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { ServerChatSearch } from '../../features/servers/server-chat-search.tsx';
import { serverChatRoute } from '../../features/servers/server-routes.ts';
import { SectionHeader } from '../../features/shell/section-header.tsx';
import { PageTopbar } from '../../features/shell/shell-topbar.tsx';

export function ServerSearchPage() {
    const navigate = useNavigate();
    const { server } = useHostedServerContext();
    return (
        <main className="flex h-full min-h-0 flex-col">
            <PageTopbar>
                <SectionHeader description="Messages across this Server." title="Search" />
            </PageTopbar>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <ServerChatSearch
                    onOpenChat={(chatId) => navigate(serverChatRoute(server.slug, chatId))}
                    serverId={server.id}
                />
            </div>
        </main>
    );
}
