import type { TaskTier } from '@haus/api';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import type { HausDatabase } from '../postgres/connection.ts';
import { asksTable, chatMessagesTable, chatsTable, messageTasksTable } from '../postgres/schema.ts';
import { threadChatIdForAnchor } from '../threads/thread-id.ts';

/** What a task row cannot say about itself, gathered once per read. */
export interface TaskTierEvidence {
    /** The assignee wrote at least one message in the task's own Thread. */
    assigneeThreadMessages: boolean;
    hasAsk: boolean;
}

/** The task columns the tier predicate reads. */
export interface TaskTierRow {
    messageId: string;
    origin: 'claimed' | 'composed' | 'converted';
    status: 'closed' | 'done' | 'in_progress' | 'in_review' | 'todo';
    trackedAt: Date | null;
}

/**
 * The only two statuses a claim passes through on its own: it is working, or
 * it finished. Any other status is somebody steering the task, which is why
 * moving to one also stamps `tracked_at` — see `stampsTaskTracked`.
 */
const backgroundStatuses = new Set<TaskTierRow['status']>(['in_progress', 'done']);

/**
 * A background claim is an Agent's record-keeping lock on work it started and
 * finished without anyone else needing to watch: it claimed a message nobody
 * had promoted, it never worked in the Thread, no Ask hangs off it, and it
 * never asked for review or outlived its own run. Anything else is tracked and
 * belongs on the default Board and List.
 *
 * Only the assignee's own Thread messages count. A Thread is where everybody
 * else's chatter about a message is meant to land, so a peer Agent or a
 * bystander replying there says nothing about whether the claimant's work
 * needs watching, and must not drag the claim onto a person's Board.
 */
export function resolveTaskTier(task: TaskTierRow, evidence: TaskTierEvidence): TaskTier {
    const background =
        task.origin === 'claimed' &&
        backgroundStatuses.has(task.status) &&
        task.trackedAt === null &&
        !(evidence.assigneeThreadMessages || evidence.hasAsk);
    return background ? 'background' : 'tracked';
}

/**
 * Whether writing this status also stamps the task tracked. Status is the one
 * tier input that can move backwards, so every exit from the claim's own
 * lifecycle — review, closure, a reopen to `todo` — is persisted the moment it
 * happens. Without the stamp a task could read background again on the next
 * status change; with it, tier only ever moves background to tracked.
 */
export function stampsTaskTracked(status: TaskTierRow['status'] | undefined): boolean {
    return status !== undefined && !backgroundStatuses.has(status);
}

const noEvidence: TaskTierEvidence = { assigneeThreadMessages: false, hasAsk: false };

/** The evidence for one task, when no batch read already gathered it. */
export function taskTierEvidenceFor(
    evidence: Map<string, TaskTierEvidence>,
    messageId: string
): TaskTierEvidence {
    return evidence.get(messageId) ?? noEvidence;
}

/**
 * At least one message in this Thread written by the task's own assignee. The
 * comparison is correlated to `message_tasks`, so every anchor is measured
 * against its own assignee in one pass, and it covers a human assignee by user
 * id. Null-safe by construction: an unassigned task matches nothing, because
 * `null = null` is unknown.
 */
const assigneeSpokeInThread = sql`exists (
    select 1 from ${chatMessagesTable} thread_message
    where thread_message.server_id = ${chatsTable.serverId}
      and thread_message.chat_id = ${chatsTable.id}
      and (
        thread_message.author_agent_id = ${messageTasksTable.assigneeAgentId}
        or thread_message.author_user_id = ${messageTasksTable.assigneeUserId}
      )
)`;

/**
 * Reads assignee Thread activity and Ask anchoring for a batch of tasks. Only a
 * claimed task can be background, so nothing else is queried.
 */
export async function loadTaskTierEvidence(
    db: Pick<HausDatabase, 'select'>,
    serverId: string,
    rows: TaskTierRow[]
): Promise<Map<string, TaskTierEvidence>> {
    const candidates = rows.filter((row) => row.origin === 'claimed' && row.trackedAt === null);
    if (candidates.length === 0) {
        return new Map();
    }
    const anchorIds = candidates.map((row) => row.messageId);
    const threadIds = anchorIds.map(threadChatIdForAnchor);
    // Sequential, never `Promise.all`: the settle path and every task write
    // read this evidence inside their own transaction, and two reads in flight
    // on that one reserved connection wedge it under the Server row lock.
    const threads = await db
        .select({ anchorMessageId: chatsTable.anchorMessageId })
        .from(chatsTable)
        .innerJoin(
            messageTasksTable,
            and(
                eq(messageTasksTable.serverId, chatsTable.serverId),
                eq(messageTasksTable.messageId, chatsTable.anchorMessageId)
            )
        )
        .where(
            and(
                eq(chatsTable.serverId, serverId),
                eq(chatsTable.kind, 'thread'),
                inArray(chatsTable.anchorMessageId, anchorIds),
                assigneeSpokeInThread
            )
        );
    const asks = await db
        .select({ chatId: asksTable.chatId, messageId: asksTable.messageId })
        .from(asksTable)
        .where(
            and(
                eq(asksTable.serverId, serverId),
                or(inArray(asksTable.messageId, anchorIds), inArray(asksTable.chatId, threadIds))
            )
        );
    const workedThreads = new Set(threads.map((thread) => thread.anchorMessageId));
    const askedAnchors = new Set(asks.map((ask) => ask.messageId));
    const askedThreads = new Set(asks.map((ask) => ask.chatId));
    return new Map(
        candidates.map((row) => [
            row.messageId,
            {
                assigneeThreadMessages: workedThreads.has(row.messageId),
                hasAsk:
                    askedAnchors.has(row.messageId) ||
                    askedThreads.has(threadChatIdForAnchor(row.messageId)),
            },
        ])
    );
}
