import type { Agent, ChatMessage, ThreadSummary } from '@grotto/api';
import type { TranscriptMessage } from '../../chats/chat-transcript-message.tsx';
import type { TranscriptActor } from '../../chats/chat-transcript-model.ts';
import type { TranscriptMessageRow } from '../../chats/transcript-contract.ts';
import type { HumanDirectory } from '../human-identity.ts';

export function mergeTaskAnchor(
    messages: ChatMessage[] | undefined,
    anchor: ChatMessage | undefined
) {
    if (!(messages && anchor) || messages.some((message) => message.id === anchor.id)) {
        return messages;
    }
    return [...messages, anchor].sort((left, right) => left.sequence - right.sequence);
}

export type ProjectedChatMessageRow = TranscriptMessageRow;

/** The directories a message's task fields are resolved against. */
export interface ChatMessageDirectories {
    handleByAgentId: ReadonlyMap<string, string>;
    humans?: HumanDirectory;
}

export function chatMessageDirectories(
    agents: readonly Agent[],
    humans?: HumanDirectory
): ChatMessageDirectories {
    return {
        handleByAgentId: new Map(agents.map((agent) => [agent.id, agent.handle])),
        humans,
    };
}

export function projectChatMessages(
    messages: readonly ChatMessage[],
    threads: readonly ThreadSummary[],
    agents: readonly Agent[] = [],
    humans?: HumanDirectory
): ProjectedChatMessageRow[] {
    const threadsByAnchor = new Map(threads.map((thread) => [thread.anchorMessageId, thread]));
    const directories = chatMessageDirectories(agents, humans);

    return messages
        .filter((message) => message.author.kind !== 'system' || message.author.system !== 'task')
        .map((message) =>
            projectChatMessage(message, threadsByAnchor.get(message.id) ?? null, directories)
        );
}

export function projectChatMessage(
    message: ChatMessage,
    thread: ThreadSummary | null,
    directories: ChatMessageDirectories
): ProjectedChatMessageRow {
    const actor = messageActor(message);
    const senderType =
        message.author.kind === 'agent'
            ? ('agent' as const)
            : message.author.kind === 'human'
              ? ('user' as const)
              : ('system' as const);
    const agentId = message.author.kind === 'agent' ? message.author.agentId : null;

    return {
        actor,
        connectsToNext: false,
        connectsToPrevious: false,
        id: message.id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            actor,
            attachments: message.attachments.map((attachment) => ({
                filename: attachment.filename,
                mediaType: attachment.mediaType,
                path: `hosted:${attachment.id}`,
                sizeBytes: attachment.sizeBytes,
                type: 'file' as const,
            })),
            content: message.content,
            id: message.id,
            sender:
                message.author.kind === 'human'
                    ? (message.author.profile?.displayName ?? message.author.userId)
                    : message.author.kind === 'agent'
                      ? (message.author.profile?.displayName ?? message.author.agentId)
                      : message.author.system === 'reminder'
                        ? 'Reminder'
                        : 'Grotto',
            senderType,
            sourceSessionId: null,
            sourceSessionKey: `hosted:${agentId ?? message.author.kind}`,
            grottoAgentId: agentId,
            ...(message.preparedAction ? { preparedAction: message.preparedAction } : {}),
            task: messageTask(message.task, directories.handleByAgentId, directories.humans),
            timestamp: message.createdAt,
        },
        responseId: agentId ? message.id : undefined,
        runId: message.author.kind === 'agent' ? message.runId : null,
        thread,
    };
}

function messageTask(
    task: ChatMessage['task'],
    handleByAgentId: ReadonlyMap<string, string>,
    humans?: HumanDirectory
): TranscriptMessage['task'] {
    if (!task) {
        return null;
    }
    return {
        assignee: taskAssignee(task, handleByAgentId, humans),
        claimed_at: task.claimedAt,
        created_at: task.createdAt,
        labels: task.labels,
        number: task.number,
        origin: task.origin,
        priority: task.priority,
        status: task.status,
        updated_at: task.updatedAt,
    };
}

function taskAssignee(
    task: NonNullable<ChatMessage['task']>,
    handleByAgentId: ReadonlyMap<string, string>,
    humans?: HumanDirectory
): { handle: string | null; id: string; kind: 'agent' | 'human' } | null {
    if (task.assigneeAgentId) {
        return {
            handle: handleByAgentId.get(task.assigneeAgentId) ?? null,
            id: task.assigneeAgentId,
            kind: 'agent',
        };
    }
    if (task.assigneeUserId) {
        return {
            handle: humans?.member(task.assigneeUserId)?.handle ?? null,
            id: task.assigneeUserId,
            kind: 'human',
        };
    }
    return null;
}

function messageActor(message: ChatMessage): TranscriptActor {
    if (message.author.kind === 'agent') {
        return { id: message.author.agentId, kind: 'agent' };
    }
    if (message.author.kind === 'human') {
        return { id: message.author.userId, kind: 'participant' };
    }
    return null;
}
