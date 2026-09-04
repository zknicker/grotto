import type { AgentAutomationEvent } from '@grotto/api';
import { recordExactMessagesServed } from '../agent-delivery/cursors.ts';
import {
    attachQueuedItemsToRun,
    listInboxItemsForRun,
    listQueuedMessageItems,
    markInboxItemsServed,
    readDeliveryState,
} from '../agent-delivery/store.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { resolveAgentMessage } from './message-read.ts';
import { targetForChat } from './message-view.ts';

const maxPulledMessages = 40;

export async function pullAgentEvents(db: GrottoDatabase, runner: ResolvedRunner) {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        const delivery = await readDeliveryState(tx, runner.agentId);
        if (delivery?.activeRunId !== runner.runId || delivery.acceptedAt === null) {
            throw new Error('The Agent run is no longer active.');
        }

        const pending = await listQueuedMessageItems(tx, runner.agentId, maxPulledMessages + 1);
        const selected = pending.slice(0, maxPulledMessages);
        const messages: Array<{
            message: Awaited<ReturnType<typeof resolveAgentMessage>>;
            target: string;
            threadFollowReactivated?: boolean;
        }> = [];
        const automations: AgentAutomationEvent[] = [];
        // Each resolver issues several queries. Bun's transaction client must not run those
        // compound query sequences concurrently or it can wait on itself indefinitely.
        for (const row of selected) {
            const target = await targetForChat(tx, runner.serverId, row.chatId);
            // A fire or a task assignment writes no Chat message, so its
            // pending row is keyed by its own identity and carries its own
            // envelope body.
            if (!row.dedupeKey.startsWith('msg_')) {
                automations.push({
                    content: row.content,
                    createdAt: row.createdAt.toISOString(),
                    id: row.dedupeKey,
                    senderHandle: typedSenderHandle(row.source),
                    senderType: row.source === 'trigger' ? 'trigger' : 'system',
                    target,
                });
                continue;
            }
            messages.push({
                message: await resolveAgentMessage(tx, runner, row.dedupeKey),
                target,
                ...(row.threadFollowReactivated ? { threadFollowReactivated: true } : {}),
            });
        }
        await attachQueuedItemsToRun(tx, {
            agentId: runner.agentId,
            itemIds: selected.map((row) => row.id),
            runId: runner.runId,
        });
        await markInboxItemsServed(tx, {
            agentId: runner.agentId,
            itemIds: selected.map((row) => row.id),
            runId: runner.runId,
        });
        await recordExactMessagesServed(tx, {
            agentId: runner.agentId,
            messages: messages.map((row) => ({ chatId: row.message.chat_id, id: row.message.id })),
            runId: runner.runId,
            serverId: runner.serverId,
        });
        return { automations, messages, more: pending.length > maxPulledMessages };
    });
}

/** Attests exact bodies returned by the Computer-local inbox cache to the active turn. */
export async function attestAgentEvents(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    identities: Array<{ chatId: string; id: string; sequence: number }>
) {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        const delivery = await readDeliveryState(tx, runner.agentId);
        if (delivery?.activeRunId !== runner.runId || delivery.acceptedAt === null) {
            throw new Error('The Agent run is no longer active.');
        }
        const requested = new Map(identities.map((identity) => [identity.id, identity]));
        const [pending, attached] = await Promise.all([
            listQueuedMessageItems(tx, runner.agentId, 1000),
            listInboxItemsForRun(tx, { agentId: runner.agentId, runId: runner.runId }),
        ]);
        const selected = [...pending, ...attached].filter((row) => requested.has(row.dedupeKey));
        const messages: Awaited<ReturnType<typeof resolveAgentMessage>>[] = [];
        // History and hold results are model-visible even when mute prevented a pending row.
        for (const identity of requested.values()) {
            const message = await resolveAgentMessage(tx, runner, identity.id);
            if (identity.chatId !== message.chat_id || identity.sequence !== message.sequence) {
                throw new Error('The local inbox receipt has a stale message boundary.');
            }
            messages.push(message);
        }
        await attachQueuedItemsToRun(tx, {
            agentId: runner.agentId,
            itemIds: pending.filter((row) => requested.has(row.dedupeKey)).map((row) => row.id),
            runId: runner.runId,
        });
        await markInboxItemsServed(tx, {
            agentId: runner.agentId,
            itemIds: selected.map((row) => row.id),
            runId: runner.runId,
        });
        await recordExactMessagesServed(tx, {
            agentId: runner.agentId,
            messages: messages.map((message) => ({ chatId: message.chat_id, id: message.id })),
            runId: runner.runId,
            serverId: runner.serverId,
        });
        return { accepted: messages.map((message) => message.id) };
    });
}

export async function inspectAgentInbox(db: GrottoDatabase, runner: ResolvedRunner) {
    const pending = await listQueuedMessageItems(db, runner.agentId, 1000);
    const groups = new Map<string, typeof pending>();
    for (const row of pending) {
        groups.set(row.chatId, [...(groups.get(row.chatId) ?? []), row]);
    }
    const rows = await Promise.all(
        [...groups.entries()].map(async ([chatId, messages]) => {
            const first = messages[0];
            const latest = messages.at(-1) ?? first;
            const target = await targetForChat(db, runner.serverId, chatId);
            return {
                chatId,
                dm: target.startsWith('dm:'),
                firstShortId: shortId(first.dedupeKey),
                latestSender: sourceHandle(latest.source),
                latestShortId: shortId(latest.dedupeKey),
                mentioned: messages.some((message) => message.mentioned),
                pendingCount: messages.length,
                target,
                thread: target.includes(':') && !target.startsWith('dm:'),
            };
        })
    );
    return { rows, totalPending: pending.length };
}

function sourceHandle(source: string) {
    if (source.startsWith('agent:')) {
        return source.slice('agent:'.length);
    }
    return source === 'task_assignment' ? 'grotto' : source;
}

/**
 * The handle a bodiless delivery speaks under. Only rows with no Chat message
 * reach this: automation fires, and the task assignment handoff, which is
 * Server-authored and so speaks as Grotto.
 */
function typedSenderHandle(source: string): AgentAutomationEvent['senderHandle'] {
    if (source === 'trigger') {
        return 'trigger';
    }
    return source === 'reminder' ? 'reminder' : 'grotto';
}

/**
 * The short id `grotto inbox` prints in a target's `first msg=`/`latest msg=`
 * slot. A Trigger or Reminder fire has no Chat message behind it, so it prints
 * `-` — the same slot the Agent's envelope header renders for a fire — instead
 * of a fire id the Agent would spend a failed `--message-id` command on.
 */
function shortId(id: string) {
    if (/^(?:rmf|trf)_/u.test(id)) {
        return '-';
    }
    return id.startsWith('msg_') ? id.slice(4, 12) : id;
}
