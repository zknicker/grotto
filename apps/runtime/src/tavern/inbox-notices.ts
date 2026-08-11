import type { TavernChatMessage } from '@tavern/api';
import { shortMessageId } from '../cli/agent-format.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { log } from '../log.ts';
import { messageMentionsAgent } from './agent-attention.ts';
import { toAgentMessage } from './agent-messages.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { formatAgentTarget } from './agent-targets.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { getChat, getMessage, listRecentMessagesBetween } from './chat-api/index.ts';
import { listInboxPierces, listPendingInboxTargets } from './inbox-cursors.ts';
import { deliverToActiveTurn } from './turn-delivery.ts';

// Content-free inbox notices (I2, ws2-turn-shapes.md §4): while an agent is
// busy, pending traffic surfaces only as batched target rows — counts, ids,
// and latest sender, never bodies. Bodies arrive via pull or the next drain.
// Injection rides the harness's own input boundary (the engine applies
// injected user messages between tool calls, never mid-generation), and a
// notice advances no cursor, ever. Rows are deduped by fingerprint so a
// target repeats only when its pending state changes.

const maxNoticeRows = 12;
const noticedFingerprints = new Map<string, Map<string, string>>();
const maxTrackedRuns = 512;

export async function noticeBusyAgent(input: { agentId: string; runId: string }) {
    const notice = composeInboxNotice(input);
    if (!notice) {
        return false;
    }
    const accepted = await deliverToActiveTurn(input.runId, notice.text).catch((error) => {
        log.warn('Inbox notice delivery failed', { err: error, runId: input.runId });
        return false;
    });
    if (accepted) {
        rememberNoticeFingerprints(input.runId, notice.fingerprints);
    }
    return accepted;
}

export function resetInboxNoticesForTesting() {
    noticedFingerprints.clear();
}

export interface InboxTargetSummary {
    chatId: string;
    dm: boolean;
    firstShortId: string;
    latestSender: string;
    latestShortId: string;
    mentioned: boolean;
    pendingCount: number;
    target: string;
    thread: boolean;
}

interface TargetNoticeRow {
    chatId: string;
    fingerprint: string;
    line: string;
    pendingCount: number;
}

export function composeInboxNotice(
    input: { agentId: string; runId: string },
    db: Database = getDb()
): { fingerprints: Map<string, string>; text: string } | null {
    const rows = collectNoticeRows(input.agentId, db);
    if (rows.length === 0) {
        return null;
    }
    const seen = noticedFingerprints.get(input.runId);
    const changed = rows.filter((row) => seen?.get(row.chatId) !== row.fingerprint);
    if (changed.length === 0) {
        return null;
    }
    const totalPending = rows.reduce((sum, row) => sum + row.pendingCount, 0);
    const shown = changed.slice(0, maxNoticeRows);
    const text = [
        '[Grotto inbox notice:',
        `Inbox update: ${totalPending} unread message${totalPending === 1 ? '' : 's'} total; ${shown.length} changed target${shown.length === 1 ? '' : 's'}`,
        ...shown.map((row) => row.line),
        ']',
    ].join('\n');
    return {
        fingerprints: new Map(shown.map((row) => [row.chatId, row.fingerprint])),
        text,
    };
}

/** Structured per-target pending summaries; `inbox check` shares them. */
export function collectInboxTargetSummaries(
    agentId: string,
    db: Database = getDb()
): InboxTargetSummary[] {
    const agent = getStoredAgent(agentId, db);
    if (!agent) {
        return [];
    }
    const participantId = createAgentParticipantId(agentId);
    const session = ensureCurrentAgentSession({ agentId }).id;
    const pendingByChat = new Map<string, TavernChatMessage[]>();
    for (const target of listPendingInboxTargets(session, db)) {
        const pending = listRecentMessagesBetween(
            target.chatId,
            {
                afterSequence: target.seenUpToSeq,
                beforeSequence: target.deliveredUpToSeq + 1,
                limit: 50,
            },
            db
        ).filter(
            (message) =>
                !message.deleted_at &&
                message.author.id !== agentId &&
                message.author.id !== participantId
        );
        if (pending.length > 0) {
            pendingByChat.set(target.chatId, pending);
        }
    }
    for (const pierce of listInboxPierces(session, { excludeServed: true }, db)) {
        const message = getMessage(pierce.messageId, db);
        if (!message || message.deleted_at) {
            continue;
        }
        const existing = pendingByChat.get(pierce.chatId) ?? [];
        if (!existing.some((row) => row.id === message.id)) {
            pendingByChat.set(pierce.chatId, [...existing, message]);
        }
    }

    const rows: InboxTargetSummary[] = [];
    for (const [chatId, messages] of pendingByChat) {
        const chat = getChat(chatId, db);
        const target = chat ? formatAgentTarget(agentId, chat, db) : null;
        if (!(chat && target)) {
            continue;
        }
        const ordered = [...messages].sort((a, b) => a.sequence - b.sequence);
        const first = ordered[0];
        const latest = ordered.at(-1);
        if (!(first && latest)) {
            continue;
        }
        rows.push({
            chatId,
            dm: chat.kind === 'dm',
            firstShortId: shortMessageId(first.id),
            latestSender: toAgentMessage(latest, db).sender.handle ?? 'unknown',
            latestShortId: shortMessageId(latest.id),
            mentioned: ordered.some((message) => messageMentionsAgent(message, agent)),
            pendingCount: ordered.length,
            target,
            thread: chat.kind === 'thread',
        });
    }
    return rows.sort((a, b) => a.target.localeCompare(b.target));
}

export function formatInboxTargetRow(row: InboxTargetSummary) {
    const tags = [
        ...(row.thread ? [' · thread'] : []),
        ...(row.dm ? [' · dm'] : []),
        ...(row.mentioned ? [' · you were mentioned'] : []),
    ].join('');
    return `${row.target}  pending: ${row.pendingCount} message${row.pendingCount === 1 ? '' : 's'} · first msg=${row.firstShortId} · latest sender @${row.latestSender} · latest msg=${row.latestShortId}${tags}`;
}

function collectNoticeRows(agentId: string, db: Database): TargetNoticeRow[] {
    return collectInboxTargetSummaries(agentId, db).map((row) => ({
        chatId: row.chatId,
        fingerprint: `${row.firstShortId}:${row.latestShortId}:${row.pendingCount}`,
        line: formatInboxTargetRow(row),
        pendingCount: row.pendingCount,
    }));
}

export function rememberNoticeFingerprints(runId: string, fingerprints: Map<string, string>) {
    const existing = noticedFingerprints.get(runId) ?? new Map<string, string>();
    for (const [chatId, fingerprint] of fingerprints) {
        existing.set(chatId, fingerprint);
    }
    noticedFingerprints.set(runId, existing);
    if (noticedFingerprints.size <= maxTrackedRuns) {
        return;
    }
    const oldest = noticedFingerprints.keys().next().value;
    if (oldest !== undefined) {
        noticedFingerprints.delete(oldest);
    }
}
