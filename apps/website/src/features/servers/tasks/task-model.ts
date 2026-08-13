import type { Agent, Chat, ChatMessage, TaskLabel, TaskListItem } from '@tavern/api';
import type { TaskPriority, TaskStatus } from '../../tasks/task-presentation.ts';
import type { HumanDirectory } from '../human-identity.ts';

export type TaskView = 'all' | 'active' | 'unassigned';

export interface TaskItem {
    assigneeAgentId: string | null;
    assigneeAvatarUrl: string | null;
    assigneeLabel: string;
    assigneeUserId: string | null;
    chatId: string;
    chatLabel: string;
    claimedAt: string | null;
    createdAt: string;
    id: string;
    labels: TaskLabel[];
    message: ChatMessage;
    number: number;
    priority: TaskPriority;
    status: TaskStatus;
    threadChatId: string;
    threadSummary: TaskListItem['threadSummary'];
    title: string;
    updatedAt: string;
    version: number;
}

export const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'closed'];

export function resolveTaskView(value: string | null): TaskView {
    return value === 'active' || value === 'unassigned' ? value : 'all';
}

export function taskClaimAction(
    task: TaskItem,
    viewerUserId: string
): 'claim' | 'claim-reservation' | 'unclaim' | null {
    if (task.status === 'done') {
        return null;
    }
    if (task.assigneeAgentId !== null) {
        return null;
    }
    if (task.assigneeUserId === null) {
        return 'claim';
    }
    if (task.assigneeUserId !== viewerUserId) {
        return null;
    }
    return task.claimedAt === null ? 'claim-reservation' : 'unclaim';
}

export function taskChatOptions(chats: Chat[], humans: HumanDirectory) {
    return chats
        .filter((chat) => !chat.peerAgentRetired)
        .map((chat) => ({
            id: chat.id,
            label:
                chat.kind === 'channel'
                    ? `#${chat.name}`
                    : `Direct · ${chat.peerAgentDisplayName ?? humans.name(chat.peerUserId)}`,
        }));
}

export function taskAssigneeName(
    task: Pick<TaskItem, 'assigneeAgentId' | 'assigneeUserId'>,
    agents: Agent[],
    humans: HumanDirectory
) {
    if (task.assigneeAgentId) {
        const agent = agents.find((candidate) => candidate.id === task.assigneeAgentId);
        return agent?.displayName ?? `Agent ${task.assigneeAgentId.slice(-6)}`;
    }
    if (task.assigneeUserId) {
        return humans.name(task.assigneeUserId);
    }
    return 'Unassigned';
}

export function taskAssigneeAvatarUrl(
    task: Pick<TaskItem, 'assigneeAgentId' | 'assigneeUserId'>,
    agents: Agent[],
    humans: HumanDirectory
) {
    if (task.assigneeAgentId) {
        return agents.find((candidate) => candidate.id === task.assigneeAgentId)?.avatarUrl ?? null;
    }
    return humans.avatarUrl(task.assigneeUserId);
}

export function toTaskItem(
    item: TaskListItem,
    humans: HumanDirectory,
    agents: Agent[] = []
): TaskItem {
    return {
        assigneeAgentId: item.task.assigneeAgentId,
        assigneeAvatarUrl: taskAssigneeAvatarUrl(item.task, agents, humans),
        assigneeLabel: taskAssigneeName(item.task, agents, humans),
        assigneeUserId: item.task.assigneeUserId,
        chatId: item.task.chatId,
        chatLabel:
            item.chatKind === 'channel'
                ? `#${item.chatName ?? 'channel'}`
                : `Direct · ${humans.name(item.chatPeerUserId)}`,
        claimedAt: item.task.claimedAt,
        createdAt: item.task.createdAt,
        id: item.message.id,
        labels: item.task.labels,
        message: item.message,
        number: item.task.number,
        priority: item.task.priority,
        status: item.task.status,
        threadChatId: item.task.threadChatId,
        threadSummary: item.threadSummary,
        title: item.message.content,
        updatedAt: item.task.updatedAt,
        version: item.task.version,
    };
}

export function filterTasks(
    tasks: TaskItem[],
    input: { labelId?: string | null; query: string; view: TaskView }
) {
    const query = input.query.trim().toLowerCase();

    return tasks.filter((task) => {
        if (input.view === 'active' && (task.status === 'done' || task.status === 'closed')) {
            return false;
        }
        if (
            input.view === 'unassigned' &&
            (task.assigneeAgentId !== null || task.assigneeUserId !== null)
        ) {
            return false;
        }
        if (input.labelId && !task.labels.some((label) => label.id === input.labelId)) {
            return false;
        }
        if (!query) {
            return true;
        }
        return (
            task.title.toLowerCase().includes(query) ||
            `#${task.number}` === query ||
            task.labels.some((label) => label.name.toLowerCase().includes(query))
        );
    });
}

// Linear-style ordering inside a status group: most urgent first, unset last.
// Board columns and list groups both ride this so the lenses agree.
const priorityRank: Record<TaskPriority, number> = {
    high: 1,
    low: 3,
    medium: 2,
    none: 4,
    urgent: 0,
};

export function groupTasks(tasks: TaskItem[]) {
    return taskStatuses.map((status) => ({
        status,
        tasks: tasks
            .filter((task) => task.status === status)
            .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]),
    }));
}
