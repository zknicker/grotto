import type { LabelRecord, TaskListItem } from '../../lib/trpc.tsx';

export type TaskView = 'all' | 'active' | 'mine';
export type TaskAssigneeFilter = 'anyone' | 'me' | 'unassigned' | `agent:${string}`;
// 'all', or a specific label id.
export type TaskLabelFilter = 'all' | string;

// The board's flat task view model (D8): a task IS a chat message promoted
// with task metadata, so rows project from the task-message list. `id` is the
// origin message id and `title` is the origin body, verbatim.
export interface TaskRecord {
    assignee: { kind: 'user' } | { agentId: string; kind: 'agent' } | null;
    createdAt: string;
    id: string;
    labels: LabelRecord[];
    number: number;
    originChatId: string;
    originChatTitle: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    title: string;
    updatedAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
export type TaskPriority = 'none' | 'urgent' | 'high' | 'medium' | 'low';

export function toTaskRecord(item: TaskListItem): TaskRecord {
    return {
        assignee: toAssignee(item.task.assignee),
        createdAt: item.task.created_at,
        id: item.message.id,
        labels: item.task.labels,
        number: item.task.number,
        originChatId: item.chat_id,
        originChatTitle: item.chat_title,
        priority: item.task.priority,
        status: item.task.status,
        title: item.message.content,
        updatedAt: item.task.updated_at,
    };
}

function toAssignee(assignee: TaskListItem['task']['assignee']): TaskRecord['assignee'] {
    if (!assignee) {
        return null;
    }
    return assignee.id === 'usr_tavern'
        ? { kind: 'user' }
        : { agentId: assignee.id, kind: 'agent' };
}

export const taskStatusOrder: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'closed'];

export const taskStatusLabels: Record<TaskStatus, string> = {
    closed: 'Closed',
    done: 'Done',
    in_progress: 'In progress',
    in_review: 'In review',
    todo: 'Todo',
};

// Status-colored chip fills for the transcript task chip and status pills:
// the Raft chip palette rides the shared label tokens.
export const taskStatusClasses: Record<TaskStatus, string> = {
    closed: 'bg-[var(--label-gray-bg)] text-[var(--label-gray-fg)]',
    done: 'bg-[var(--label-green-bg)] text-[var(--label-green-fg)]',
    in_progress: 'bg-[var(--label-blue-bg)] text-[var(--label-blue-fg)]',
    in_review: 'bg-[var(--label-purple-bg)] text-[var(--label-purple-fg)]',
    todo: 'bg-[var(--label-orange-bg)] text-[var(--label-orange-fg)]',
};

// Status hue for the TaskStatusDisc on neutral surfaces (board headers,
// list groups) where there is no chip fill to carry the color.
export const taskStatusDiscClasses: Record<TaskStatus, string> = {
    closed: 'text-[var(--label-gray-fg)]',
    done: 'text-[var(--label-green-fg)]',
    in_progress: 'text-[var(--label-blue-fg)]',
    in_review: 'text-[var(--label-purple-fg)]',
    todo: 'text-[var(--label-orange-fg)]',
};

export const taskPriorityOrder: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];

export const taskPriorityLabels: Record<TaskPriority, string> = {
    high: 'High',
    low: 'Low',
    medium: 'Medium',
    none: 'No priority',
    urgent: 'Urgent',
};

export function formatTaskNumber(task: Pick<TaskRecord, 'number'>) {
    return `#${task.number}`;
}

// Active = live or demanding attention: claimed, running, or awaiting the
// user's check. Terminal states stay out.
export function isActiveTask(task: TaskRecord) {
    return task.status === 'todo' || task.status === 'in_progress' || task.status === 'in_review';
}

export function groupTasksByStatus(tasks: TaskRecord[]) {
    return taskStatusOrder
        .map((status) => ({
            status,
            tasks: tasks.filter((task) => task.status === status),
        }))
        .filter((group) => group.tasks.length > 0);
}

export function filterTasks(input: {
    assignee: TaskAssigneeFilter;
    conversationId?: string;
    label: TaskLabelFilter;
    query: string;
    tasks: TaskRecord[];
    view: TaskView;
}) {
    const query = input.query.trim().toLowerCase();

    return input.tasks.filter((task) => {
        if (input.conversationId && task.originChatId !== input.conversationId) {
            return false;
        }

        if (!matchesView(task, input.view)) {
            return false;
        }

        if (!matchesAssignee(task, input.assignee)) {
            return false;
        }

        if (input.label !== 'all' && !task.labels.some((label) => label.id === input.label)) {
            return false;
        }

        if (!query) {
            return true;
        }

        return (
            task.title.toLowerCase().includes(query) ||
            formatTaskNumber(task).toLowerCase() === query ||
            task.labels.some((label) => label.name.toLowerCase().includes(query))
        );
    });
}

function matchesView(task: TaskRecord, view: TaskView) {
    switch (view) {
        case 'active':
            return isActiveTask(task);
        case 'mine':
            return task.assignee?.kind === 'user';
        default:
            return true;
    }
}

function matchesAssignee(task: TaskRecord, assignee: TaskAssigneeFilter) {
    if (assignee === 'anyone') {
        return true;
    }

    if (assignee === 'unassigned') {
        return task.assignee === null;
    }

    if (assignee === 'me') {
        return task.assignee?.kind === 'user';
    }

    return (
        task.assignee?.kind === 'agent' && task.assignee.agentId === assignee.slice('agent:'.length)
    );
}
