import { useNavigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverTaskThreadRoute } from '../../features/servers/server-routes.ts';
import { ServerTasksSurface } from '../../features/servers/tasks/server-tasks-surface.tsx';

export function ServerTasksPage() {
    const navigate = useNavigate();
    const { chats, server } = useHostedServerContext();
    return (
        <ServerTasksSurface
            chats={chats}
            onOpenTask={(task) =>
                navigate(serverTaskThreadRoute(server.slug, task.chatId, task.id))
            }
            role={server.role}
            serverId={server.id}
            viewerUserId={server.viewerUserId}
        />
    );
}
