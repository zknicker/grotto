import { ArchivedChatsPage } from '../../features/servers/chat/archived-chats-page.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';

export function ArchivedChatsRoute() {
    const { server } = useHostedServerContext();
    return <ArchivedChatsPage server={server} />;
}
