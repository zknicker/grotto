import { advanceServedCursor, markAgentInboxPiercesServed } from '../agent-delivery/cursors.ts';
import {
    attachQueuedPendingToRun,
    listPendingForRun,
    listQueuedMessagePending,
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
        const messages = await Promise.all(
            selected.map(async (row) => ({
                message: await resolveAgentMessage(tx, runner, row.dedupeKey),
                target: await targetForChat(tx, runner.serverId, row.chatId),
            }))
        );
        await attachQueuedPendingToRun(tx, {
            agentId: runner.agentId,
            pendingIds: selected.map((row) => row.id),
            runId: runner.runId,
        });
        const servedByChat = new Map<string, number>();
        const piercedMessageIds: string[] = [];
        for (const [index, row] of messages.entries()) {
            if (selected[index]?.pierced) {
                piercedMessageIds.push(row.message.id);
                continue;
            }
            servedByChat.set(
                row.message.chat_id,
                Math.max(servedByChat.get(row.message.chat_id) ?? 0, row.message.sequence)
            );
        }
        for (const [chatId, sequence] of servedByChat) {
            await advanceServedCursor(tx, {
                agentId: runner.agentId,
                chatId,
                sequence,
                serverId: runner.serverId,
            });
        }
        await markAgentInboxPiercesServed(tx, {
            agentId: runner.agentId,
            messageIds: piercedMessageIds,
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
        const messages = await Promise.all(
            selected.map(async (row) => {
                const message = await resolveAgentMessage(tx, runner, row.dedupeKey);
                const identity = requested.get(row.dedupeKey);
                if (
                    !identity ||
                    identity.chatId !== message.chat_id ||
                    identity.sequence !== message.sequence
                ) {
                    throw new Error('The local inbox receipt has a stale message boundary.');
                }
                return message;
            })
        );
        await attachQueuedPendingToRun(tx, {
            agentId: runner.agentId,
            pendingIds: pending.filter((row) => requested.has(row.dedupeKey)).map((row) => row.id),
            runId: runner.runId,
        });
        await advanceVisibleCursors(tx, runner, selected, messages);
        return { accepted: selected.map((row) => row.dedupeKey) };
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
                mentioned: false,
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

async function advanceVisibleCursors(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    rows: Array<{ pierced: boolean }>,
    messages: Array<{ chat_id: string; id: string; sequence: number }>
) {
    const servedByChat = new Map<string, number>();
    const piercedMessageIds: string[] = [];
    for (const [index, message] of messages.entries()) {
        if (rows[index]?.pierced) {
            piercedMessageIds.push(message.id);
        } else {
            servedByChat.set(
                message.chat_id,
                Math.max(servedByChat.get(message.chat_id) ?? 0, message.sequence)
            );
        }
    }
    for (const [chatId, sequence] of servedByChat) {
        await advanceServedCursor(db, {
            agentId: runner.agentId,
            chatId,
            sequence,
            serverId: runner.serverId,
        });
    }
    await markAgentInboxPiercesServed(db, {
        agentId: runner.agentId,
        messageIds: piercedMessageIds,
        serverId: runner.serverId,
    });
}
