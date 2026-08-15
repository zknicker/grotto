import { TaskContent } from '../../features/servers/tasks/task-content.tsx';
import { TaskControls } from '../../features/servers/tasks/task-controls.tsx';
import { TaskThreadDialog } from '../../features/servers/tasks/task-thread-dialog.tsx';
import { useTaskView } from '../../features/servers/tasks/task-view.ts';
import { SectionHeader } from '../../features/shell/section-header.tsx';
import { PageTopbar } from '../../features/shell/shell-topbar.tsx';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

export function TasksPage() {
    useWindowTitle('Tasks');
    const { openTask } = useTaskView();

    return (
        <section aria-label="Tasks" className="flex min-h-0 flex-1 flex-col">
            <PageTopbar>
                <SectionHeader>
                    <TaskControls />
                </SectionHeader>
            </PageTopbar>
            <TaskContent onOpenTask={(task) => openTask(task.id)} />
            <TaskThreadDialog />
        </section>
    );
}
