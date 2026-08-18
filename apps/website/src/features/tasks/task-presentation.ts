export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
export type TaskPriority = 'none' | 'urgent' | 'high' | 'medium' | 'low';

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

export function formatTaskNumber(task: { number: number }) {
    return `#${task.number}`;
}
