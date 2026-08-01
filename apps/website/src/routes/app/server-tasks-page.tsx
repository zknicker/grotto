import { useNavigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverTaskThreadRoute } from '../../features/servers/server-routes.ts';
import {
    ServerTasksBody,
    ServerTasksHeaderControls,
    ServerTasksProvider,
} from '../../features/servers/tasks/server-tasks-surface.tsx';
import { SectionHeader } from '../../features/shell/section-header.tsx';
import { PageTopbar } from '../../features/shell/shell-topbar.tsx';

export function ServerTasksPage() {
    const navigate = useNavigate();
    const { chats, server } = useHostedServerContext();
    return (
        <ServerTasksProvider
            chats={chats}
            onOpenTask={(task) =>
                navigate(serverTaskThreadRoute(server.slug, task.chatId, task.id))
            }
            role={server.role}
            serverId={server.id}
            viewerUserId={server.viewerUserId}
        >
            <section aria-label="Server tasks" className="flex min-h-0 flex-1 flex-col">
                <PageTopbar>
                    <SectionHeader title="Tasks">
                        <ServerTasksHeaderControls />
                    </SectionHeader>
                </PageTopbar>
                <ServerTasksBody />
            </section>
        </ServerTasksProvider>
    );
}
