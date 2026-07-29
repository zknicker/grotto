import type { IconSvgElement } from '@hugeicons/react';
import {
    CheckListIcon,
    DashboardSquare01Icon,
    LeftToRightListBulletIcon,
    Loading03Icon,
    UserIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import type { BulkTaskUpdate, BulkTaskUpdateResult } from '../../hooks/tasks/use-task-mutations.ts';
import type { TaskSelection } from '../../hooks/tasks/use-task-selection.ts';
import type { LabelRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import type { AgentSelectOption } from '../agents/agent-option-label.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { TaskBulkActions } from './task-bulk-actions.tsx';
import {
    groupTasksByStatus,
    type TaskAssigneeFilter,
    type TaskLabelFilter,
    type TaskRecord,
    type TaskView,
} from './task-presentation.ts';
import { TasksBoard } from './tasks-board.tsx';
import { TaskStatusGroup } from './tasks-list.tsx';
import { TasksToolbar } from './tasks-toolbar.tsx';

export type TaskViewMode = 'board' | 'list';

const taskViews: Array<{ icon: IconSvgElement; label: string; value: TaskView }> = [
    { icon: CheckListIcon, label: 'All tasks', value: 'all' },
    { icon: Loading03Icon, label: 'Active', value: 'active' },
    { icon: UserIcon, label: 'My tasks', value: 'mine' },
];

const viewModes: Array<{ icon: IconSvgElement; label: string; value: TaskViewMode }> = [
    { icon: DashboardSquare01Icon, label: 'Board', value: 'board' },
    { icon: LeftToRightListBulletIcon, label: 'List', value: 'list' },
];

interface TasksViewProps {
    agents: AgentSelectOption[];
    assignee: TaskAssigneeFilter;
    bulkUpdate: (updates: BulkTaskUpdate[]) => Promise<BulkTaskUpdateResult>;
    embedded?: boolean;
    filteredTasks: TaskRecord[];
    label: TaskLabelFilter;
    labels: LabelRecord[];
    mode: TaskViewMode;
    onAssigneeChange: (assignee: TaskAssigneeFilter) => void;
    onClearFilters: () => void;
    onCreate: () => void;
    onLabelChange: (label: TaskLabelFilter) => void;
    onModeChange: (mode: TaskViewMode) => void;
    onOpen: (task: TaskRecord) => void;
    onQueryChange: (query: string) => void;
    onViewChange: (view: TaskView) => void;
    query: string;
    selectedTasks: TaskRecord[];
    selection: TaskSelection;
    tasks: TaskRecord[];
    view: TaskView;
}

export function TasksView({
    agents,
    assignee,
    bulkUpdate,
    embedded = false,
    filteredTasks,
    label,
    labels,
    mode,
    onAssigneeChange,
    onClearFilters,
    onCreate,
    onModeChange,
    onOpen,
    onLabelChange,
    onQueryChange,
    onViewChange,
    query,
    selectedTasks,
    selection,
    tasks,
    view,
}: TasksViewProps) {
    const groups = groupTasksByStatus(filteredTasks);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div
                className={cn(
                    'grid min-h-0 flex-1 grid-cols-1',
                    !embedded && 'md:grid-cols-[240px_minmax(0,1fr)]'
                )}
            >
                <aside
                    className={cn(
                        'flex min-h-0 flex-col border-[var(--content-card-border)] border-r bg-[var(--sidebar)] pt-[calc(var(--topbar-height)-4px)] max-md:hidden',
                        embedded && 'hidden'
                    )}
                >
                    <SidebarGroup className="pt-0">
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {taskViews.map((taskView) => (
                                    <SidebarMenuItem key={taskView.value}>
                                        <SidebarMenuButton
                                            isActive={taskView.value === view}
                                            onClick={() => onViewChange(taskView.value)}
                                        >
                                            <Icon aria-hidden="true" icon={taskView.icon} />
                                            <span>{taskView.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </aside>

                <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    <nav
                        aria-label="Task views"
                        className={cn(
                            'flex flex-wrap gap-1 px-2 pt-2 md:hidden',
                            embedded && 'hidden'
                        )}
                    >
                        {taskViews.map((taskView) => {
                            const isActive = taskView.value === view;

                            return (
                                <button
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                                        isActive
                                            ? 'bg-active font-medium text-foreground'
                                            : 'text-muted-foreground hover:bg-hover hover:text-foreground'
                                    )}
                                    key={taskView.value}
                                    onClick={() => onViewChange(taskView.value)}
                                    type="button"
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4 shrink-0 opacity-80"
                                        icon={taskView.icon}
                                    />
                                    {taskView.label}
                                </button>
                            );
                        })}
                    </nav>

                    <TasksToolbar
                        agents={agents}
                        assignee={assignee}
                        hideCreate={embedded}
                        label={label}
                        labels={labels}
                        onAssigneeChange={onAssigneeChange}
                        onCreate={onCreate}
                        onLabelChange={onLabelChange}
                        onQueryChange={onQueryChange}
                        query={query}
                    >
                        <ViewModeToggle mode={mode} onModeChange={onModeChange} />
                    </TasksToolbar>

                    {tasks.length === 0 ? (
                        <TasksEmpty embedded={embedded} onCreate={onCreate} />
                    ) : filteredTasks.length === 0 ? (
                        <TasksEmptyResults onClearFilters={onClearFilters} />
                    ) : mode === 'board' ? (
                        <TasksBoard agents={agents} onOpen={onOpen} tasks={filteredTasks} />
                    ) : (
                        <div className="min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
                            <div className="flex flex-col pb-8">
                                {groups.map((group) => (
                                    <TaskStatusGroup
                                        agents={agents}
                                        isSelected={selection.isSelected}
                                        key={group.status}
                                        onOpen={onOpen}
                                        onToggleSelect={(task, selectMode) =>
                                            selection.select(task.id, selectMode)
                                        }
                                        selectionActive={selection.selectionActive}
                                        status={group.status}
                                        tasks={group.tasks}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === 'list' && selectedTasks.length > 0 ? (
                        <TaskBulkActions
                            agents={agents}
                            bulkUpdate={bulkUpdate}
                            labels={labels}
                            onClear={selection.clear}
                            selectedTasks={selectedTasks}
                        />
                    ) : null}
                </section>
            </div>
        </div>
    );
}

function ViewModeToggle({
    mode,
    onModeChange,
}: {
    mode: TaskViewMode;
    onModeChange: (mode: TaskViewMode) => void;
}) {
    return (
        <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5">
            {viewModes.map((option) => (
                <button
                    aria-label={`${option.label} view`}
                    aria-pressed={option.value === mode}
                    className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                        option.value === mode
                            ? 'bg-active font-medium text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                    key={option.value}
                    onClick={() => onModeChange(option.value)}
                    type="button"
                >
                    <Icon aria-hidden="true" className="size-4" icon={option.icon} />
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function TasksEmpty({ embedded, onCreate }: { embedded: boolean; onCreate: () => void }) {
    if (embedded) {
        return (
            <EmptyState
                description="Send a message as a task from this conversation, or ask an agent to file one, and it will appear here."
                title="No tasks yet"
            />
        );
    }
    return (
        <EmptyState
            actionLabel="New task"
            description="Create a task, or ask an agent to file one from chat. Tasks are messages promoted with task metadata, shared between you and your agents."
            onAction={onCreate}
            title="No tasks yet"
        />
    );
}

function TasksEmptyResults({ onClearFilters }: { onClearFilters: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">
                No tasks match the current view, filters, or search.
            </p>
            <button
                className="mt-2 text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground"
                onClick={onClearFilters}
                type="button"
            >
                Clear filters
            </button>
        </div>
    );
}
