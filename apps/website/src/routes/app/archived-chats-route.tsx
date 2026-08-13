import { ArchivedChatsPage } from '../../features/servers/chat/archived-chats-page.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

export function ArchivedChatsRoute() {
    const { server } = useHostedServerContext();
    useWindowTitle('Archived');
    return <ArchivedChatsPage server={server} />;
}
