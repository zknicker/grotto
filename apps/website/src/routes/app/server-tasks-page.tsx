import { useNavigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverChatRoute } from '../../features/servers/server-routes.ts';
import { ServerTasksSurface } from '../../features/servers/tasks/server-tasks-surface.tsx';

export function ServerTasksPage() {
    const navigate = useNavigate();
    const { chats, server } = useHostedServerContext();
    return (
        <ServerTasksSurface
            chats={chats}
            onOpenTask={(task) => navigate(serverChatRoute(server.slug, task.chatId))}
            role={server.role}
            serverId={server.id}
            viewerUserId={server.viewerUserId}
        />
    );
}
