import { ArchivedChatsPage } from '../../features/servers/chat/archived-chats-page.tsx';
import { useServerContext } from '../../features/servers/server-context.ts';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

export function ArchivedChatsRoute() {
    const { server } = useServerContext();
    useWindowTitle('Archived');
    return <ArchivedChatsPage server={server} />;
}
