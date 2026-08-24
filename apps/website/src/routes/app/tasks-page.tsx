import { useServerContext } from '../../features/servers/server-context.ts';
import { TaskContent } from '../../features/servers/tasks/task-content.tsx';
import { TaskControls } from '../../features/servers/tasks/task-controls.tsx';
import { TaskFilterRow } from '../../features/servers/tasks/task-filter-row.tsx';
import { useTaskFilterFields } from '../../features/servers/tasks/task-filters.tsx';
import { TaskThreadDialog } from '../../features/servers/tasks/task-thread-dialog.tsx';
import { useTaskView } from '../../features/servers/tasks/task-view.ts';
import { SectionBar, SectionHeader } from '../../features/shell/section-header.tsx';
import { PageTopbar } from '../../features/shell/shell-topbar.tsx';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

export function TasksPage() {
    useWindowTitle('Tasks');
    const { server } = useServerContext();
    const { openTask } = useTaskView();
    const fields = useTaskFilterFields();
    const canManage = server.role === 'owner' || server.role === 'admin';
    const hasFilters = fields.some((field) => field.applied !== null);

    return (
        <section aria-label="Tasks" className="flex min-h-0 flex-1 flex-col">
            <PageTopbar>
                <SectionHeader title="Tasks">
                    <TaskControls canManage={canManage} fields={fields} />
                </SectionHeader>
            </PageTopbar>
            {/* The applied query earns a band only once there is one to state. */}
            {hasFilters ? (
                <SectionBar>
                    <TaskFilterRow fields={fields} />
                </SectionBar>
            ) : null}
            <TaskContent onOpenTask={(task) => openTask(task.id)} />
            <TaskThreadDialog />
        </section>
    );
}
