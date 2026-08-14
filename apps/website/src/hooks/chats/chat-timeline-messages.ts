import type { ChatLogOutput } from '../../lib/trpc.tsx';

const sessionRailMaxGapMs = 5 * 60 * 1000;

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];
type ServerChatLogPage = NonNullable<ChatLogOutput>;
// The server-side chat log page no longer carries live turn state
// (specs/chat-timeline.md); these callers are unreachable now that no
// turn.* runtime event drives them, but keep the type shape they expect.
type ChatLogPage = ServerChatLogPage & {
    activeReplies: never[];
    failedTurns: never[];
    settledRunIds: never[];
};
type ChatLogInput = ServerChatLogPage;
type ChatMessageRow = Extract<ChatLogRow, { kind: 'message' }>;

const localTimelineMessageMetadataKey = '__tavernLocalTimelineMessage';

export interface ChatTimelineMessage {
    attachments?: ChatMessageRow['message']['attachments'];
    content: string;
    id: string;
    metadata?: Record<string, unknown>;
    sessionKey?: string | null;
    timestamp: string;
}

export function isLocalTimelineMessageMetadata(
    metadata: Record<string, unknown> | null | undefined
) {
    return metadata?.[localTimelineMessageMetadataKey] === true;
}

export function withLocalTimelineMessageMetadata(metadata?: Record<string, unknown>) {
    return {
        ...(metadata ?? {}),
        [localTimelineMessageMetadataKey]: true,
    };
}

function getRowTimestampMs(row: ChatLogRow) {
    const timestamp =
        row.kind === 'message'
            ? row.message.timestamp
            : row.kind === 'system'
              ? row.timestamp
              : row.kind === 'worker'
                ? (row.startedAt ??
                  row.completedAt ??
                  row.worker.lastEventAt ??
                  row.worker.createdAt)
                : (row.startedAt ?? row.completedAt);
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function getRowSessionKey(row: ChatLogRow) {
    if (row.kind === 'message') {
        const sessionKey = row.message.sourceSessionKey.trim();
        return sessionKey.length > 0 ? sessionKey : null;
    }

    if (row.kind === 'tool') {
        return row.sessionKey;
    }

    if (row.kind === 'worker') {
        return row.sessionKey ?? row.worker.sessionKey;
    }

    return null;
}

function getActorKey(row: ChatLogRow | null) {
    if (!row || row.kind === 'system') {
        return null;
    }

    return row.actor ? `${row.actor.kind}:${row.actor.id}` : null;
}

function compareChatLogRows(left: ChatLogRow, right: ChatLogRow) {
    const timestampDelta = getRowTimestampMs(left) - getRowTimestampMs(right);

    return timestampDelta || getRowSortRank(left) - getRowSortRank(right);
}

function getRowSortRank(row: ChatLogRow) {
    if (row.kind === 'message') {
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}

function canConnectSessionRail(currentRow: ChatLogRow, adjacentRow: ChatLogRow | null) {
    if (!adjacentRow || currentRow.kind === 'system' || adjacentRow.kind === 'system') {
        return false;
    }

    const currentSessionKey = getRowSessionKey(currentRow);
    const adjacentSessionKey = getRowSessionKey(adjacentRow);

    if (!currentSessionKey || currentSessionKey !== adjacentSessionKey) {
        return false;
    }

    return (
        Math.abs(getRowTimestampMs(currentRow) - getRowTimestampMs(adjacentRow)) <=
        sessionRailMaxGapMs
    );
}

function buildUserMessageRow(
    input: {
        attachments?: ChatMessageRow['message']['attachments'];
        content: string;
        id: string;
        metadata?: Record<string, unknown>;
        sessionKey?: string | null;
        timestamp: string;
    },
    tavernUserId: string | null
): ChatMessageRow {
    const sourceSessionKey = input.sessionKey?.trim() ?? '';
    // Match the acting user's durable author id so the optimistic row stays
    // right-anchored when the server row lands. Keyless uses usr_tavern.
    const ownerActor = { id: tavernUserId ?? 'usr_tavern', kind: 'participant' as const };

    return {
        actor: ownerActor,
        connectsToNext: false,
        connectsToPrevious: false,
        id: input.id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            actor: ownerActor,
            attachments: input.attachments,
            content: input.content,
            id: input.id,
            metadata: withLocalTimelineMessageMetadata(input.metadata),
            sender: 'You',
            senderType: 'user',
            sourceSessionId: null,
            sourceSessionKey,
            timestamp: input.timestamp,
        },
    };
}

function createEmptyLog(limit: number): ChatLogPage {
    return {
        activeReplies: [],
        failedTurns: [],
        limit,
        nextBeforeSequence: null,
        rows: [],
        settledRunIds: [],
        totalMessages: 0,
    };
}

function isMatchingLoggedUserMessage(row: ChatMessageRow, message: ChatTimelineMessage) {
    return row.id === message.id || row.message.id === message.id;
}

function recomputeRowConnections(rows: ChatLogRow[]): ChatLogRow[] {
    return rows.map((row, index) => {
        if (row.kind === 'system') {
            return row;
        }

        const previousRow = rows[index - 1] ?? null;
        const nextRow = rows[index + 1] ?? null;
        const connectsToPrevious = canConnectSessionRail(row, previousRow);

        return {
            ...row,
            connectsToNext: canConnectSessionRail(row, nextRow),
            connectsToPrevious,
            isFirstInGroup: getActorKey(previousRow) !== getActorKey(row) || !connectsToPrevious,
        };
    });
}

export function appendTimelineMessage(
    current: ChatLogInput | undefined,
    input: ChatTimelineMessage,
    tavernUserId: string | null = null
): ChatLogPage | undefined {
    if (!current || current.rows.some((row) => row.id === input.id)) {
        return current ? normalizeChatLog(current) : undefined;
    }

    const source = normalizeChatLog(current);
    const nextRows = recomputeRowConnections(
        [...source.rows, buildUserMessageRow(input, tavernUserId)].sort(compareChatLogRows)
    );

    return {
        ...source,
        rows: nextRows,
        totalMessages: source.totalMessages + 1,
    };
}

export function mergeTimelineMessages(input: {
    limit: number;
    logged: ChatLogInput | undefined;
    messages: readonly ChatTimelineMessage[];
    tavernUserId?: string | null;
}): ChatLogPage | undefined {
    if (!input.logged && input.messages.length === 0) {
        return undefined;
    }

    const initial = input.logged ? normalizeChatLog(input.logged) : createEmptyLog(input.limit);

    const merged = input.messages.reduce(
        (current, message) =>
            appendTimelineMessage(current, message, input.tavernUserId ?? null) ?? current,
        initial
    );

    return {
        ...merged,
        rows: recomputeRowConnections([...merged.rows].sort(compareChatLogRows)),
    };
}

export function getLoggedTimelineMessageIds(
    logged: ChatLogInput | undefined,
    messages: readonly ChatTimelineMessage[]
) {
    if (!logged || messages.length === 0) {
        return [];
    }

    const loggedUserRows = logged.rows.filter(
        (row): row is ChatMessageRow => row.kind === 'message' && row.message.senderType === 'user'
    );
    const confirmedIds: string[] = [];
    let searchStart = 0;

    for (const message of messages) {
        for (let index = searchStart; index < loggedUserRows.length; index += 1) {
            if (!isMatchingLoggedUserMessage(loggedUserRows[index], message)) {
                continue;
            }

            confirmedIds.push(message.id);
            searchStart = index + 1;
            break;
        }
    }

    return confirmedIds;
}

function normalizeChatLog(log: ChatLogInput): ChatLogPage {
    return {
        activeReplies: [],
        failedTurns: [],
        limit: log.limit,
        nextBeforeSequence: log.nextBeforeSequence,
        rows: log.rows,
        settledRunIds: [],
        totalMessages: log.totalMessages,
    };
}
