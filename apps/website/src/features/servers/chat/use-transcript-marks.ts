import type { ChatMessage } from '@grotto/api';
import * as React from 'react';
import { deriveSessionMarks } from '../../chats/session/session-mark-model.ts';
import { deriveHandledTaskMarks } from '../../tasks/task-mark-model.ts';

/**
 * The header marks no single row can derive.
 *
 * Both are differences across the loaded page rather than facts on a message:
 * whether an Agent started a new session is a change from its own previous
 * message, and which reply closed a background claim is the first thing that
 * Agent said after taking it. Deriving them once here keeps every row's own
 * render a lookup.
 */
export function useTranscriptMarks(messages: readonly ChatMessage[]) {
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
                              tier: message.task.tier,
                              updatedAt: message.task.updatedAt,
                          }
                        : null,
                }))
            ),
        [messages]
    );

    return { handledTaskMarks, sessionMarks };
}
