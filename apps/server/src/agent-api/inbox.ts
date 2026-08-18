import { recordExactMessagesServed } from '../agent-delivery/cursors.ts';
import {
    attachQueuedPendingToRun,
    listPendingForRun,
    listQueuedMessagePending,
    markPendingServed,
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

        const pending = await listQueuedMessagePending(tx, runner.agentId, maxPulledMessages + 1);
        const selected = pending.slice(0, maxPulledMessages);
        const messages: Array<{
            message: Awaited<ReturnType<typeof resolveAgentMessage>>;
            target: string;
            threadFollowReactivated?: boolean;
        }> = [];
        // Each resolver issues several queries. Bun's transaction client must not run those
        // compound query sequences concurrently or it can wait on itself indefinitely.
        for (const row of selected) {
            messages.push({
                message: await resolveAgentMessage(tx, runner, row.dedupeKey),
                target: await targetForChat(tx, runner.serverId, row.chatId),
                ...(row.threadFollowReactivated ? { threadFollowReactivated: true } : {}),
            });
        }
        await attachQueuedPendingToRun(tx, {
            agentId: runner.agentId,
            pendingIds: selected.map((row) => row.id),
            runId: runner.runId,
        });
        await markPendingServed(tx, {
            agentId: runner.agentId,
            pendingIds: selected.map((row) => row.id),
            runId: runner.runId,
        });
        await recordExactMessagesServed(tx, {
            agentId: runner.agentId,
            messages: messages.map((row) => ({ chatId: row.message.chat_id, id: row.message.id })),
            runId: runner.runId,
            serverId: runner.serverId,
        });
        return { messages, more: pending.length > maxPulledMessages };
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
            listQueuedMessagePending(tx, runner.agentId, 1000),
            listPendingForRun(tx, { agentId: runner.agentId, runId: runner.runId }),
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
        await attachQueuedPendingToRun(tx, {
            agentId: runner.agentId,
            pendingIds: pending.filter((row) => requested.has(row.dedupeKey)).map((row) => row.id),
            runId: runner.runId,
        });
        await markPendingServed(tx, {
            agentId: runner.agentId,
            pendingIds: selected.map((row) => row.id),
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
    const pending = await listQueuedMessagePending(db, runner.agentId, 1000);
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
    return source.startsWith('agent:') ? source.slice('agent:'.length) : source;
}

function shortId(id: string) {
    return id.startsWith('msg_') ? id.slice(4, 12) : id;
}
