import type { HostedAgent, HostedChatMessage, HostedThreadSummary } from '@tavern/api';
import * as React from 'react';
import type { HumanDirectory } from '../human-identity.ts';
import {
    chatMessageDirectories,
    type ProjectedChatMessageRow,
    projectChatMessage,
} from './chat-message-model.ts';

export interface ChatMessageProjectionInput {
    agents: readonly HostedAgent[];
    humans?: HumanDirectory;
    messages: readonly HostedChatMessage[];
    threads: readonly HostedThreadSummary[];
}

export interface ChatMessageProjection extends ChatMessageProjectionInput {
    rowByMessage: ReadonlyMap<HostedChatMessage, ProjectedChatMessageRow>;
    rows: ProjectedChatMessageRow[];
}

export const emptyChatMessages: readonly HostedChatMessage[] = [];
export const emptyChatThreads: readonly HostedThreadSummary[] = [];
export const emptyChatAgents: readonly HostedAgent[] = [];

export const emptyChatMessageProjection: ChatMessageProjection = {
    agents: emptyChatAgents,
    messages: emptyChatMessages,
    rowByMessage: new Map(),
    rows: [],
    threads: emptyChatThreads,
};

/**
 * Rebuilds only the rows a refetch actually changed.
 *
 * React Query's structural sharing hands back the *same* message object for
 * every message the server returned unchanged, so source identity is the
 * change signal — hosted messages carry no version or `updatedAt` field. A row
 * is reprojected only when its message object, its thread summary, or (for a
 * task message) the Agent/human directories behind its assignee changed.
 * Everything else keeps its previous row object, which is what lets the
 * transcript's row memo skip re-rendering and re-parsing untouched markdown.
 */
export function projectStableChatMessages(
    input: ChatMessageProjectionInput,
    previous: ChatMessageProjection
): ChatMessageProjection {
    if (
        previous.messages === input.messages &&
        previous.threads === input.threads &&
        previous.agents === input.agents &&
        previous.humans === input.humans
    ) {
        return previous;
    }

    const threadsByAnchor = new Map(
        input.threads.map((thread) => [thread.anchorMessageId, thread])
    );
    const directories = chatMessageDirectories(input.agents, input.humans);
    const directoriesChanged = previous.agents !== input.agents || previous.humans !== input.humans;
    const rowByMessage = new Map<HostedChatMessage, ProjectedChatMessageRow>();
    let reusedEveryRow = previous.rows.length === input.messages.length;

    const rows = input.messages.map((message, index) => {
        const thread = threadsByAnchor.get(message.id) ?? null;
        const cached = previous.rowByMessage.get(message);
        const row =
            cached && cached.thread === thread && !(directoriesChanged && message.task)
                ? cached
                : projectChatMessage(message, thread, directories);

        rowByMessage.set(message, row);

        if (reusedEveryRow && previous.rows[index] !== row) {
            reusedEveryRow = false;
        }

        return row;
    });

    return {
        agents: input.agents,
        humans: input.humans,
        messages: input.messages,
        // Keeping the array itself when nothing moved lets the downstream
        // entry and render-row memos hold too.
        rowByMessage,
        rows: reusedEveryRow ? previous.rows : rows,
        threads: input.threads,
    };
}

export function useStableChatMessageRows({
    agents,
    humans,
    messages,
    threads,
}: ChatMessageProjectionInput) {
    const projectionRef = React.useRef<ChatMessageProjection>(emptyChatMessageProjection);

    return React.useMemo(() => {
        const next = projectStableChatMessages(
            { agents, humans, messages, threads },
            projectionRef.current
        );

        projectionRef.current = next;

        return next.rows;
    }, [agents, humans, messages, threads]);
}
