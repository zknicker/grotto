import { advanceServedCursor } from '../agent-delivery/cursors.ts';
import { listQueuedPending } from '../agent-delivery/store.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { resolveAgentMessage } from './message-read.ts';
import { targetForChat } from './message-view.ts';

const maxPulledMessages = 40;

export async function pullAgentEvents(db: GrottoDatabase, runner: ResolvedRunner) {
    const pending = await listQueuedPending(db, runner.agentId, maxPulledMessages + 1);
    const selected = pending.slice(0, maxPulledMessages);
    const messages = await Promise.all(
        selected.map(async (row) => ({
            message: await resolveAgentMessage(db, runner, row.dedupeKey),
            target: await targetForChat(db, runner.serverId, row.chatId),
        }))
    );
    const servedByChat = new Map<string, number>();
    for (const row of messages) {
        servedByChat.set(
            row.message.chat_id,
            Math.max(servedByChat.get(row.message.chat_id) ?? 0, row.message.sequence)
        );
    }
    for (const [chatId, sequence] of servedByChat) {
        await advanceServedCursor(db, {
            agentId: runner.agentId,
            chatId,
            sequence,
            serverId: runner.serverId,
        });
    }
    return { messages, more: pending.length > maxPulledMessages };
}

export async function inspectAgentInbox(db: GrottoDatabase, runner: ResolvedRunner) {
    const pending = await listQueuedPending(db, runner.agentId, 1000);
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
