import type { AgentRuntimeAgentActivityEntry } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { listRecentAgentTurns } from './agent-turn-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { listChatsForAgentParticipant } from './chat-api/index.ts';

// Agent activity feed (specs/agent-activity.md): a turn-grained projection
// over durable turn rows and session-reset receipts. Turns float on the
// session (I1) — entries carry no chat anchor; replies are ordinary chat
// messages the agent sent via the CLI, not turn outcomes.

const defaultLimit = 20;
const maxLimit = 50;

export function listAgentActivity(
    input: { agentId: string; limit?: number },
    db: Database = getDb()
): AgentRuntimeAgentActivityEntry[] {
    const limit = Math.min(Math.max(input.limit ?? defaultLimit, 1), maxLimit);
    const entries: AgentRuntimeAgentActivityEntry[] = [];

    for (const turn of listRecentAgentTurns({ agentId: input.agentId, limit }, db)) {
        entries.push({
            at: turn.createdAt,
            detail: turn.kind === 'start' ? 'Session start' : null,
            kind: 'message_received',
            turnId: turn.id,
        });
        if (turn.completedAt && turn.status !== 'queued' && turn.status !== 'running') {
            entries.push({
                at: turn.completedAt,
                detail:
                    turn.status === 'failed' && typeof turn.metadata.error === 'string'
                        ? turn.metadata.error
                        : null,
                kind:
                    turn.status === 'failed'
                        ? 'failed'
                        : turn.status === 'cancelled'
                          ? 'stopped'
                          : 'completed',
                turnId: turn.id,
            });
        }
    }
    entries.push(...newSessionEntries(input.agentId, limit, db));

    return entries.sort((left, right) => (left.at < right.at ? 1 : -1)).slice(0, limit);
}

// Session rotations land a durable system receipt in the agent's built-in DM
// (specs/sessions.md); the reason rides metadata so the feed reads intent
// directly instead of parsing display text.
function newSessionEntries(
    agentId: string,
    limit: number,
    db: Database
): AgentRuntimeAgentActivityEntry[] {
    const participantId = createAgentParticipantId(agentId);
    const dm = listChatsForAgentParticipant(participantId, db).find((chat) => chat.kind === 'dm');
    if (!dm) {
        return [];
    }
    const rows = db
        .prepare(
            `SELECT created_at,
                    json_extract(metadata_json, '$.runtime.reason') AS reason
             FROM chat_messages
             WHERE chat_id = $chatId
               AND role = 'system'
               AND json_extract(metadata_json, '$.runtime.notice') = 'new_session'
             ORDER BY created_at DESC
             LIMIT $limit`
        )
        .all(namedParams({ chatId: dm.id, limit })) as {
        created_at: string;
        reason: null | string;
    }[];

    return rows.map((row) => ({
        at: row.created_at,
        detail: resetReasonLabel(row.reason),
        kind: 'new_session' as const,
        turnId: null,
    }));
}

function resetReasonLabel(reason: null | string) {
    if (reason === 'full') {
        return 'full reset';
    }
    if (reason === 'recovery') {
        return 'recovery';
    }
    if (reason === 'session') {
        return 'manual reset';
    }
    return null;
}
