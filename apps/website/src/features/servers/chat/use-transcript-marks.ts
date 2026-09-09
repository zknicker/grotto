import type { ChatMessage, ThreadSummary } from '@grotto/api';
import * as React from 'react';
import { deriveSessionMarks } from '../../chats/session/session-mark-model.ts';
import { deriveHandledTaskMarks } from '../../tasks/task-mark-model.ts';

const noThreads: readonly ThreadSummary[] = [];

/**
 * The header marks no single row can derive.
 *
 * Both are differences across the loaded page rather than facts on a message:
 * whether an Agent started a new session is a change from its own previous
 * message, and which reply closed a task is the first thing that Agent said
 * after taking it. Deriving them once here keeps every row's own render a
 * lookup.
 */
export function useTranscriptMarks(
    messages: readonly ChatMessage[],
    threads: readonly ThreadSummary[] = noThreads
) {
    // A task whose Thread surface carries its chip carries its outcome there
    // too, so no reply elsewhere in the transcript takes its receipt. A
    // background claim's surface never carries that chip, so its Thread's
    // replies leave the receipt where it was.
    const threadedAnchors = React.useMemo(
        () =>
            new Set(
                threads
                    .filter((thread) => thread.replyCount > 0)
                    .map((thread) => thread.anchorMessageId)
            ),
        [threads]
    );
    const sessionMarks = React.useMemo(
        () =>
            deriveSessionMarks(
                messages.map((message) => ({
                    agentId: message.author.kind === 'agent' ? message.author.agentId : null,
                    id: message.id,
                    sessionGeneration: message.sessionGeneration,
                }))
            ),
        [messages]
    );
    const handledTaskMarks = React.useMemo(
        () =>
            deriveHandledTaskMarks(
                messages.map((message) => ({
                    agentId: message.author.kind === 'agent' ? message.author.agentId : null,
                    id: message.id,
                    task: message.task
                        ? {
                              assigneeAgentId: message.task.assigneeAgentId,
                              claimedAt: message.task.claimedAt,
                              live: message.task.live,
                              number: message.task.number,
                              status: message.task.status,
                              threadStatesTask:
                                  message.task.tier !== 'background' &&
                                  threadedAnchors.has(message.id),
                              updatedAt: message.task.updatedAt,
                          }
                        : null,
                }))
            ),
        [messages, threadedAnchors]
    );

    return { handledTaskMarks, sessionMarks };
}
