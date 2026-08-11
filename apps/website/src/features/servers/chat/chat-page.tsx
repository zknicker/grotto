import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useHostedChat } from '../../../hooks/servers/use-chat.ts';
import { useChats } from '../../../hooks/servers/use-chats.ts';
import { useTasks } from '../../../hooks/servers/use-tasks.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { serverChatRoute, serverRoute } from '../server-routes.ts';
import { resolveChatPageChat } from './chat-page-state.ts';
import { ChatView } from './chat-view.tsx';

export function ChatPage({ chatId, server }: { chatId: string; server: ServerDetail }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const chatQuery = useHostedChat(server.id, chatId);
    const chats = useChats(server.id);
    const chat = resolveChatPageChat({
        detail: chatQuery.data,
        isPending: chatQuery.isPending,
        listed: chats.data?.find((candidate) => candidate.id === chatId),
    });
    const tasks = useTasks(server.id, chatId);
    const taskMessageId = searchParams.get('task');
    const initialTask = tasks.data?.find((item) => item.task.messageId === taskMessageId);

    if (!chat && chatQuery.isPending) {
        return null;
    }

    if (!chat) {
        return <Navigate replace to={serverRoute(server.slug)} />;
    }

    return (
        <ChatView
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
            key={chat.id}
            onOpenChat={(nextChatId) => navigate(serverChatRoute(server.slug, nextChatId))}
            server={server}
        />
    );
}
