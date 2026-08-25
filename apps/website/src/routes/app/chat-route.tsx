import { useParams } from 'react-router-dom';
import { ChatPage } from '../../features/servers/chat/chat-page.tsx';
import { ImplicitAgentDmPage } from '../../features/servers/chat/implicit-agent-dm-page.tsx';
import { useServerContext } from '../../features/servers/server-context.ts';

export function ChatRoute() {
    const { chatId = '' } = useParams();
    const { server } = useServerContext();
    return <ChatPage chatId={chatId} server={server} />;
}

export function ImplicitAgentDmRoute() {
    const { agentId = '' } = useParams();
    const { server } = useServerContext();
    return <ImplicitAgentDmPage agentId={agentId} server={server} />;
}
