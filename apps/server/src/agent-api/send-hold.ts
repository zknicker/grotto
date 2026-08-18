import { and, desc, eq, gt, ne, or, sql } from 'drizzle-orm';
import {
    advanceSeenCursor,
    readAgentInboxCursor,
    recordExactMessagesServed,
} from '../agent-delivery/cursors.ts';
import { readMessageAttachments } from '../attachments/message-attachments.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentInboxExactVisibilityTable,
    agentMessageDraftsTable,
    agentsTable,
    chatMessagesTable,
    chatsTable,
} from '../postgres/schema.ts';
import { messageSelection, toAgentMessages } from './message-view.ts';

const draftTtlMs = 10 * 60 * 1000;
const maxHoldMessages = 12;

export class AgentSendModeError extends Error {
    constructor(
        message: string,
        readonly code: string,
        readonly status: number
    ) {
        super(message);
        this.name = 'AgentSendModeError';
    }
}

export interface AgentSendModeInput {
    attachmentIds: string[];
    content?: string;
    continueAnyway: boolean;
    nonce: string;
    sendDraft: boolean;
}

export async function prepareAgentSend(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    input: AgentSendModeInput
) {
    validateMode(input);
    const committed = await readCommittedSend(db, runner, chatId, input.nonce);
    if (committed) {
        return {
            kind: 'send' as const,
            outgoing: {
                attachmentIds: committed.attachmentIds,
                content: input.content ?? committed.content,
            },
        };
    }
    const cursor = await readAgentInboxCursor(db, { ...runner, chatId });
    const draft = await readDraft(db, runner, chatId, cursor.generation);
    const outgoing = input.sendDraft
        ? requireDraft(draft)
        : {
              attachmentIds: input.attachmentIds,
              content: requireContent(input.content),
              reholdCount: draft?.reholdCount ?? 0,
          };
    if (input.continueAnyway && outgoing.reholdCount < 2) {
        throw new AgentSendModeError(
            'continueAnyway is only available after repeated holds of the same draft.',
            'SEND_ANYWAY_NOT_ELIGIBLE',
            409
        );
    }
    const hold = input.continueAnyway
        ? null
        : await resolveHold(db, runner, chatId, cursor.generation, cursor.seen);
    if (!hold) {
        return { kind: 'send' as const, outgoing };
    }
    const handle = await readAgentHandle(db, runner);
    const reholdCount = outgoing.reholdCount + 1;
    await saveDraft(db, runner, chatId, cursor.generation, {
        ...outgoing,
        reholdCount,
    });
    return {
        kind: 'held' as const,
        response: {
            continueAnywaySuggested: reholdCount >= 2,
            formalMentionCount: countMentions(hold.messages, handle),
            newMessageCount: hold.total,
            omittedMessageCount: Math.max(0, hold.total - hold.messages.length),
            reholdCount,
            shownMessages: hold.messages,
            state: 'held' as const,
        },
    };
}

export async function clearAgentDraft(db: GrottoDatabase, runner: ResolvedRunner, chatId: string) {
    await db
        .delete(agentMessageDraftsTable)
        .where(
            and(
                eq(agentMessageDraftsTable.serverId, runner.serverId),
                eq(agentMessageDraftsTable.agentId, runner.agentId),
                eq(agentMessageDraftsTable.chatId, chatId)
            )
        );
}

async function resolveHold(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    sessionGeneration: number,
    horizon: number
) {
    const [chat] = await db
        .select({ kind: chatsTable.kind, latest: chatsTable.lastMessageSequence })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, runner.serverId), eq(chatsTable.id, chatId)))
        .limit(1);
    if (!chat || (chat.kind !== 'channel' && chat.kind !== 'thread') || chat.latest <= horizon) {
        return null;
    }
    const peer = and(
        eq(chatMessagesTable.serverId, runner.serverId),
        eq(chatMessagesTable.chatId, chatId),
        gt(chatMessagesTable.sequence, horizon),
        sql`not exists (
            select 1 from ${agentInboxExactVisibilityTable} exact_visibility
            where exact_visibility.server_id = ${runner.serverId}
              and exact_visibility.agent_id = ${runner.agentId}
              and exact_visibility.session_generation = ${sessionGeneration}
              and exact_visibility.chat_id = ${chatId}
              and exact_visibility.message_id = ${chatMessagesTable.id}
              and (
                exact_visibility.seen_at is not null
                or exact_visibility.served_run_id = ${runner.runId}
              )
        )`,
        or(
            sql`${chatMessagesTable.authorUserId} is not null`,
            and(
                sql`${chatMessagesTable.authorAgentId} is not null`,
                ne(chatMessagesTable.authorAgentId, runner.agentId)
            )
        )
    );
    const [count] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(chatMessagesTable)
        .where(peer);
    const rows = (
        await db
            .select(messageSelection)
            .from(chatMessagesTable)
            .where(peer)
            .orderBy(desc(chatMessagesTable.sequence))
            .limit(maxHoldMessages)
    ).reverse();
    if (rows.length === 0) {
        // This query has proven that every freshness-relevant message through
        // the current Chat head is either behind the boundary or exactly seen.
        await advanceSeenCursor(db, {
            agentId: runner.agentId,
            chatId,
            sequence: chat.latest,
            serverId: runner.serverId,
        });
        return null;
    }
    await recordExactMessagesServed(db, {
        agentId: runner.agentId,
        messages: rows.map((row) => ({ chatId: row.chatId, id: row.id })),
        runId: runner.runId,
        serverId: runner.serverId,
    });
    return {
        messages: await toAgentMessages(db, runner.serverId, rows),
        total: count?.total ?? rows.length,
    };
}

async function readDraft(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    generation: number
) {
    const [draft] = await db
        .select()
        .from(agentMessageDraftsTable)
        .where(
            and(
                eq(agentMessageDraftsTable.serverId, runner.serverId),
                eq(agentMessageDraftsTable.agentId, runner.agentId),
                eq(agentMessageDraftsTable.sessionGeneration, generation),
                eq(agentMessageDraftsTable.chatId, chatId)
            )
        )
        .limit(1);
    if (!draft) {
        return null;
    }
    if (Date.now() - draft.savedAt.getTime() >= draftTtlMs) {
        await clearAgentDraft(db, runner, chatId);
        return null;
    }
    return draft;
}

async function saveDraft(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    generation: number,
    draft: { attachmentIds: string[]; content: string; reholdCount: number }
) {
    await db
        .insert(agentMessageDraftsTable)
        .values({
            agentId: runner.agentId,
            attachmentIds: draft.attachmentIds,
            chatId,
            content: draft.content,
            reholdCount: draft.reholdCount,
            serverId: runner.serverId,
            sessionGeneration: generation,
        })
        .onConflictDoUpdate({
            set: { ...draft, savedAt: new Date() },
            target: [
                agentMessageDraftsTable.serverId,
                agentMessageDraftsTable.agentId,
                agentMessageDraftsTable.sessionGeneration,
                agentMessageDraftsTable.chatId,
            ],
        });
}

async function readCommittedSend(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    nonce: string
) {
    const [message] = await db
        .select({
            authorAgentId: chatMessagesTable.authorAgentId,
            content: chatMessagesTable.content,
            id: chatMessagesTable.id,
        })
        .from(chatMessagesTable)
        .where(
            and(
                eq(chatMessagesTable.serverId, runner.serverId),
                eq(chatMessagesTable.chatId, chatId),
                eq(chatMessagesTable.nonce, nonce)
            )
        )
        .limit(1);
    if (!message || message.authorAgentId !== runner.agentId) {
        return null;
    }
    const attachmentIds = (
        (await readMessageAttachments(db, runner.serverId, [message.id])).get(message.id) ?? []
    ).map(({ id }) => id);
    return { attachmentIds, content: message.content };
}

function validateMode(input: AgentSendModeInput) {
    if (input.continueAnyway && !input.sendDraft) {
        throw new AgentSendModeError(
            'continueAnyway requires sendDraft.',
            'SEND_DRAFT_ANYWAY_REQUIRES_SEND_DRAFT',
            400
        );
    }
    if (input.sendDraft && input.content !== undefined) {
        throw new AgentSendModeError(
            'sendDraft does not accept content.',
            'SEND_DRAFT_STDIN_UNSUPPORTED',
            400
        );
    }
    if (input.sendDraft && input.attachmentIds.length > 0) {
        throw new AgentSendModeError(
            'sendDraft does not accept attachment ids.',
            'SEND_DRAFT_ATTACHMENTS_UNSUPPORTED',
            400
        );
    }
}

function requireContent(content: string | undefined) {
    if (!content?.trim()) {
        throw new AgentSendModeError('Message content is required.', 'MISSING_CONTENT', 400);
    }
    return content;
}

function requireDraft(draft: Awaited<ReturnType<typeof readDraft>>) {
    if (!draft) {
        throw new AgentSendModeError(
            'No saved draft exists for this target.',
            'SEND_DRAFT_NOT_FOUND',
            404
        );
    }
    return draft;
}

async function readAgentHandle(db: GrottoDatabase, runner: ResolvedRunner) {
    const [agent] = await db
        .select({ handle: agentsTable.handle })
        .from(agentsTable)
        .where(and(eq(agentsTable.serverId, runner.serverId), eq(agentsTable.id, runner.agentId)))
        .limit(1);
    if (!agent) {
        throw new AgentSendModeError('The Agent no longer exists.', 'AGENT_NOT_FOUND', 404);
    }
    return agent.handle;
}

export function countAgentFormalMentions(
    messages: Array<{ content: string }>,
    agentHandle: string
) {
    const mention = new RegExp(`(^|\\s)@${escapeRegex(agentHandle)}(?=$|[\\s.,!?;:])`, 'iu');
    return messages.filter(({ content }) => mention.test(content)).length;
}

function countMentions(messages: Array<{ content: string }>, agentHandle: string) {
    return countAgentFormalMentions(messages, agentHandle);
}

function escapeRegex(value: string) {
    return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
