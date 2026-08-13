import { useNavigate } from 'react-router-dom';
import { ChatSearch } from '../../features/servers/chat/chat-search.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverChatRoute } from '../../features/servers/server-routes.ts';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

export function SearchRoute() {
    const navigate = useNavigate();
    const { server } = useHostedServerContext();
    useWindowTitle('Search');
    return (
        <ChatSearch
            onOpenChat={(chatId) => navigate(serverChatRoute(server.slug, chatId))}
            serverId={server.id}
        />
    );
}
