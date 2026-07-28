import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { ServerChat } from '../../features/servers/server-chat.tsx';
import { serverActivityRoute, serverChatRoute } from '../../features/servers/server-routes.ts';

export function ServerChatPage() {
    const { chatId = '' } = useParams();
    const navigate = useNavigate();
    const { agents, chats, server } = useHostedServerContext();
    const chat = chats.find((candidate) => candidate.id === chatId);

    if (!chat) {
        return <Navigate replace to={serverActivityRoute(server.slug)} />;
    }

    return (
        <ServerChat
            agents={agents}
            chat={chat}
            onOpenChat={(nextChatId) => navigate(serverChatRoute(server.slug, nextChatId))}
            role={server.role}
            server={server}
            viewerUserId={server.viewerUserId}
        />
    );
}
