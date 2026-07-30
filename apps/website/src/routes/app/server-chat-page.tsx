import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { ServerChat } from '../../features/servers/server-chat.tsx';
import { serverActivityRoute, serverChatRoute } from '../../features/servers/server-routes.ts';
import { useServerTasks } from '../../hooks/servers/use-server-tasks.ts';

export function ServerChatPage() {
    const { chatId = '' } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { agents, chats, server } = useHostedServerContext();
    const chat = chats.find((candidate) => candidate.id === chatId);
    const tasks = useServerTasks(server.id, chatId);
    const taskMessageId = searchParams.get('task');
    const initialTask = tasks.data?.find((item) => item.task.messageId === taskMessageId);

    if (!chat) {
        return <Navigate replace to={serverActivityRoute(server.slug)} />;
    }

    return (
        <ServerChat
            agents={agents}
            chat={chat}
            initialTask={
                initialTask
                    ? {
                          message: initialTask.message,
                          summary: initialTask.threadSummary,
                          threadChatId: initialTask.task.threadChatId,
                      }
                    : undefined
            }
            onOpenChat={(nextChatId) => navigate(serverChatRoute(server.slug, nextChatId))}
            role={server.role}
            server={server}
            viewerUserId={server.viewerUserId}
        />
    );
}
