import { useParams } from 'react-router-dom';
import { ChatPage } from '../../features/servers/chat/chat-page.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';

export function ChatRoute() {
    const { chatId = '' } = useParams();
    const { server } = useHostedServerContext();
    return <ChatPage chatId={chatId} server={server} />;
}
