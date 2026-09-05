import { ListView } from '@heroui-pro/react';
import { TaskStatusDisc } from '../../tasks/task-status-disc.tsx';
import type { TaskItem } from '../tasks/task-model.ts';

/** Tasks in review the viewer filed or is reserved for. */
export function NeedsYouTaskList({
    onOpenTask,
    tasks,
}: {
    onOpenTask: (messageId: string) => void;
    tasks: readonly TaskItem[];
}) {
    return (
        <ListView
            aria-label="Tasks that need you"
            items={tasks}
            onAction={(key) => onOpenTask(String(key))}
            variant="secondary"
        >
            {(task) => (
                <ListView.Item id={task.id} textValue={task.title}>
                    <ListView.ItemContent>
                        {/* Status and number read as one leading identity
                            cluster, the way the Tasks list row pairs them. */}
                        <span className="flex shrink-0 items-center gap-1.5">
                            <TaskStatusDisc className="size-4" status={task.status} />
                            <span className="font-mono text-muted text-xs tabular-nums">
                                #{task.number}
                            </span>
                        </span>
                        <div className="flex min-w-0 flex-col">
                            <ListView.Title>{task.title}</ListView.Title>
                            <ListView.Description>
                                {task.chatLabel} · {task.assigneeLabel}
                            </ListView.Description>
                        </div>
                    </ListView.ItemContent>
                </ListView.Item>
            )}
        </ListView>
    );
}
