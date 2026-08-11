import type { HostedAgent, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import type { ChatLogOutput } from '../../../lib/trpc.tsx';
import type { TranscriptMessage } from '../../chats/chat-transcript-message.tsx';
import type { TranscriptActor } from '../../chats/chat-transcript-model.ts';
import type { HumanDirectory } from '../human-identity.ts';

export function mergeTaskAnchor(
    messages: HostedChatMessage[] | undefined,
    anchor: HostedChatMessage | undefined
) {
    if (!(messages && anchor) || messages.some((message) => message.id === anchor.id)) {
        return messages;
    }
    return [...messages, anchor].sort((left, right) => left.sequence - right.sequence);
}

export type ProjectedChatRow = NonNullable<ChatLogOutput>['rows'][number];
export type ProjectedChatMessageRow = Extract<ProjectedChatRow, { kind: 'message' }>;

/** The directories a message's task fields are resolved against. */
export interface ChatMessageDirectories {
    handleByAgentId: ReadonlyMap<string, string>;
    humans?: HumanDirectory;
}

export function chatMessageDirectories(
    agents: readonly HostedAgent[],
    humans?: HumanDirectory
): ChatMessageDirectories {
    return {
        handleByAgentId: new Map(agents.map((agent) => [agent.id, agent.handle])),
        humans,
    };
}

export function projectChatMessages(
    messages: readonly HostedChatMessage[],
    threads: readonly HostedThreadSummary[],
    agents: readonly HostedAgent[] = [],
    humans?: HumanDirectory
): ProjectedChatMessageRow[] {
    const threadsByAnchor = new Map(threads.map((thread) => [thread.anchorMessageId, thread]));
    const directories = chatMessageDirectories(agents, humans);

    return messages.map((message) =>
        projectChatMessage(message, threadsByAnchor.get(message.id) ?? null, directories)
    );
}

export function projectChatMessage(
    message: HostedChatMessage,
    thread: HostedThreadSummary | null,
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
            tavernAgentId: agentId,
            task: messageTask(message.task, directories.handleByAgentId, directories.humans),
            timestamp: message.createdAt,
        },
        responseId: agentId ? message.id : undefined,
        runId: agentId ? `hosted:${message.id}` : null,
        thread,
    };
}

function messageTask(
    task: HostedChatMessage['task'],
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
    task: NonNullable<HostedChatMessage['task']>,
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

function messageActor(message: HostedChatMessage): TranscriptActor {
    if (message.author.kind === 'agent') {
        return { id: message.author.agentId, kind: 'agent' };
    }
    if (message.author.kind === 'human') {
        return { id: message.author.userId, kind: 'participant' };
    }
    return null;
}
