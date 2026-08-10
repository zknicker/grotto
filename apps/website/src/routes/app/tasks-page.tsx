import { useNavigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { taskThreadRoute } from '../../features/servers/server-routes.ts';
import { TaskContent } from '../../features/servers/tasks/task-content.tsx';
import { TaskControls, TaskSearch } from '../../features/servers/tasks/task-controls.tsx';
import { SectionHeader } from '../../features/shell/section-header.tsx';
import { PageTopbar } from '../../features/shell/shell-topbar.tsx';

export function TasksPage() {
    const navigate = useNavigate();
    const { server } = useHostedServerContext();

    return (
        <section aria-label="Tasks" className="flex min-h-0 flex-1 flex-col">
            <PageTopbar>
                <SectionHeader title="Tasks">
                    <TaskSearch />
                    <TaskControls />
                </SectionHeader>
            </PageTopbar>
            <TaskContent
                onOpenTask={(task) => navigate(taskThreadRoute(server.slug, task.chatId, task.id))}
            />
        </section>
    );
}
