import type {
    HostedChat,
    HostedChatMessage,
    HostedTaskLabel,
    HostedTaskListItem,
} from '@tavern/api';
import type { TaskPriority, TaskStatus } from '../../tasks/task-presentation.ts';
import type { HumanDirectory } from '../human-identity.ts';

export type ServerTaskView = 'all' | 'active' | 'unassigned';

export interface ServerTask {
    assigneeAgentId: string | null;
    assigneeUserId: string | null;
    chatId: string;
    chatLabel: string;
    claimedAt: string | null;
    createdAt: string;
    id: string;
    labels: HostedTaskLabel[];
    message: HostedChatMessage;
    number: number;
    priority: TaskPriority;
    status: TaskStatus;
    threadChatId: string;
    threadSummary: HostedTaskListItem['threadSummary'];
    title: string;
    updatedAt: string;
    version: number;
}

export const serverTaskStatuses: TaskStatus[] = [
    'todo',
    'in_progress',
    'in_review',
    'done',
    'closed',
];

export function serverTaskClaimAction(
    task: ServerTask,
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

export function serverTaskChatOptions(chats: HostedChat[], humans: HumanDirectory) {
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

export function toServerTask(item: HostedTaskListItem, humans: HumanDirectory): ServerTask {
    return {
        assigneeAgentId: item.task.assigneeAgentId,
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

export function filterServerTasks(
    tasks: ServerTask[],
    input: { labelId?: string | null; query: string; view: ServerTaskView }
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

export function groupServerTasks(tasks: ServerTask[]) {
    return serverTaskStatuses.map((status) => ({
        status,
        tasks: tasks.filter((task) => task.status === status),
    }));
}
