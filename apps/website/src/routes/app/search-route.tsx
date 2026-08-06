import { useNavigate } from 'react-router-dom';
import { ChatSearch } from '../../features/servers/chat/chat-search.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverChatRoute } from '../../features/servers/server-routes.ts';
import { SectionHeader } from '../../features/shell/section-header.tsx';
import { PageTopbar } from '../../features/shell/shell-topbar.tsx';

export function SearchRoute() {
    const navigate = useNavigate();
    const { server } = useHostedServerContext();
    return (
        <main className="flex h-full min-h-0 flex-col">
            <PageTopbar>
                <SectionHeader description="Messages across this Server." title="Search" />
            </PageTopbar>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <ChatSearch
                    onOpenChat={(chatId) => navigate(serverChatRoute(server.slug, chatId))}
                    serverId={server.id}
                />
            </div>
        </main>
    );
}
