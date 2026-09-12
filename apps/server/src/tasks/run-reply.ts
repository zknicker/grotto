import type { AgentActivityCategory } from '@haus/api';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { HausDatabase } from '../postgres/connection.ts';
import { agentActivityTable, chatMessagesTable } from '../postgres/schema.ts';

type ActivityReader = Pick<HausDatabase, 'select'>;

/**
 * What the run's last word in the task's anchor Chat proves. A `finishing`
 * reply came after the run stopped working and is the answer; an
 * `acknowledgment` is the "I'm on it" the managed prompt asks for before deep
 * work, and proves only that the run started.
 */
export type RunReplyKind = 'acknowledgment' | 'finishing' | 'none';

/**
 * Activity that is the run talking, waiting, or thinking rather than doing the
 * work. Everything else — reading, editing, running commands, browsing,
 * searching, using tools, rewriting instructions — is a tool-shaped operation,
 * and a reply that precedes the last of those is an acknowledgment.
 */
const conversationalCategories: AgentActivityCategory[] = [
    'checking_messages',
    'sending_message',
    'starting_work',
    'thinking',
    'working',
];

/** Both stamps are Server clock: `chat_messages.created_at` and `agent_activity.recorded_at`. */
export interface RunReplyEvidence {
    /** When the run last stopped doing tool-shaped work, or null if it never did. */
    lastOperationAt: Date | null;
    /** The run's most recent top-level reply in the anchor Chat, or null. */
    latestReplyAt: Date | null;
}

/**
 * A reply resolves the claim only if the run had nothing left to do after it.
 * A run with no operations at all is a pure answer. Equal stamps read as
 * finishing: a reply written in the same transaction tick as the operation it
 * reports is the report, not an acknowledgment of work still to come.
 */
export function classifyRunReply(evidence: RunReplyEvidence): RunReplyKind {
    if (evidence.latestReplyAt === null) {
        return 'none';
    }
    if (evidence.lastOperationAt === null) {
        return 'finishing';
    }
    return evidence.latestReplyAt.getTime() >= evidence.lastOperationAt.getTime()
        ? 'finishing'
        : 'acknowledgment';
}

/**
 * Reads the run's reply and its last operation from the one database that
 * stamped both. `agent_activity.occurred_at` is whatever the Computer reported,
 * so ordering reads `recorded_at`, which Server writes on arrival.
 */
export async function classifyRunReplyInChat(
    db: ActivityReader,
    scope: { agentId: string; runId: string; serverId: string },
    chatId: string
): Promise<RunReplyKind> {
    const [reply] = await db
        .select({ createdAt: chatMessagesTable.createdAt })
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, scope.serverId),
                eq(chatMessagesTable.chatId, chatId),
                eq(chatMessagesTable.authorAgentId, scope.agentId),
                eq(chatMessagesTable.runId, scope.runId)
            )
        )
        .orderBy(desc(chatMessagesTable.createdAt), desc(chatMessagesTable.sequence))
        .limit(1);
    if (!reply) {
        return 'none';
    }
    const [operation] = await db
        .select({ recordedAt: agentActivityTable.recordedAt })
        .from(agentActivityTable)
        .where(
            and(
                eq(agentActivityTable.serverId, scope.serverId),
                eq(agentActivityTable.agentId, scope.agentId),
                eq(agentActivityTable.runId, scope.runId),
                notInArray(agentActivityTable.category, conversationalCategories)
            )
        )
        .orderBy(desc(agentActivityTable.recordedAt))
        .limit(1);
    return classifyRunReply({
        lastOperationAt: operation?.recordedAt ?? null,
        latestReplyAt: reply.createdAt,
    });
}
