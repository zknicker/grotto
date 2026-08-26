import {
    type AgentCreatePreparedAction,
    agentCreateActionInputSchema,
    type PreparedAction,
    type PreparedActionMedia,
    preparedActionSchema,
} from '@grotto/api';
import { and, eq, inArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { preparedActionMediaTable, preparedActionsTable } from '../postgres/schema.ts';
import { preparedActionMediaUrlFor } from './media.ts';

type PreparedActionRow = typeof preparedActionsTable.$inferSelect;
type PreparedActionMediaRow = typeof preparedActionMediaTable.$inferSelect;

export async function readPreparedAction(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    actionId: string
): Promise<PreparedAction | null> {
    const [row] = await db
        .select({ action: preparedActionsTable, media: preparedActionMediaTable })
        .from(preparedActionsTable)
        .leftJoin(
            preparedActionMediaTable,
            and(
                eq(preparedActionMediaTable.serverId, preparedActionsTable.serverId),
                eq(preparedActionMediaTable.actionId, preparedActionsTable.id)
            )
        )
        .where(
            and(eq(preparedActionsTable.serverId, serverId), eq(preparedActionsTable.id, actionId))
        )
        .limit(1);

    return row ? toPreparedAction(row.action, row.media) : null;
}

export async function readPreparedActionsForMessages(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, PreparedAction>> {
    if (messageIds.length === 0) {
        return new Map();
    }

    const rows = await db
        .select({ action: preparedActionsTable, media: preparedActionMediaTable })
        .from(preparedActionsTable)
        .leftJoin(
            preparedActionMediaTable,
            and(
                eq(preparedActionMediaTable.serverId, preparedActionsTable.serverId),
                eq(preparedActionMediaTable.actionId, preparedActionsTable.id)
            )
        )
        .where(
            and(
                eq(preparedActionsTable.serverId, serverId),
                inArray(preparedActionsTable.messageId, messageIds)
            )
        );

    return new Map(
        rows.map((row) => [row.action.messageId, toPreparedAction(row.action, row.media)])
    );
}

function toPreparedAction(
    row: PreparedActionRow,
    media: PreparedActionMediaRow | null
): PreparedAction {
    const base = {
        chatId: row.chatId,
        createdAt: row.createdAt.toISOString(),
        executedAt: row.executedAt?.toISOString() ?? null,
        executedByUserId: row.executedByUserId,
        id: row.id,
        messageId: row.messageId,
        proposerAgentId: row.proposerAgentId,
        status: row.status,
        supersededAt: row.supersededAt?.toISOString() ?? null,
        supersededByActionId: row.supersededByActionId,
    };

    if (row.kind === 'agent:create') {
        if (!media) {
            throw new Error(`Prepared action ${row.id} has no action-owned media.`);
        }
        const stored = readStoredAgentCreateProposal(row.proposal);
        return preparedActionSchema.parse({
            ...base,
            kind: 'agent:create',
            proposal: {
                ...stored,
                avatar: toPreparedActionMedia(media),
            },
        }) as AgentCreatePreparedAction;
    }

    return preparedActionSchema.parse({
        ...base,
        kind: row.kind,
        proposal: isJsonObject(row.proposal) ? row.proposal : {},
    });
}

function readStoredAgentCreateProposal(value: unknown) {
    if (!isJsonObject(value)) {
        throw new Error('A prepared Agent creation proposal is not an object.');
    }
    const { avatarMediaId: _avatarMediaId, ...proposal } = value;
    return agentCreateActionInputSchema.parse(proposal);
}

function toPreparedActionMedia(row: PreparedActionMediaRow): PreparedActionMedia {
    return {
        byteSize: row.byteSize,
        id: row.id,
        mediaType: row.mediaType,
        sha256: row.sha256,
        url: preparedActionMediaUrlFor(row.id),
    };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
