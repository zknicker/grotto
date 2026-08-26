import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { AgentCreateActionInput } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    chatMessagesTable,
    preparedActionMediaTable,
    preparedActionsTable,
} from '../postgres/schema.ts';
import { PreparedActionConflictError } from './errors.ts';
import type { PreparedActionAvatarBytes } from './prepare.ts';

export async function readActionByNonce(
    db: Pick<GrottoDatabase, 'select'>,
    runner: ResolvedRunner,
    nonce: string
) {
    const [row] = await db
        .select({
            chatId: preparedActionsTable.chatId,
            id: preparedActionsTable.id,
            messageId: preparedActionsTable.messageId,
            nonce: preparedActionsTable.nonce,
            proposal: preparedActionsTable.proposal,
            sequence: chatMessagesTable.sequence,
        })
        .from(preparedActionsTable)
        .innerJoin(
            chatMessagesTable,
            and(
                eq(chatMessagesTable.serverId, preparedActionsTable.serverId),
                eq(chatMessagesTable.chatId, preparedActionsTable.chatId),
                eq(chatMessagesTable.id, preparedActionsTable.messageId)
            )
        )
        .where(
            and(
                eq(preparedActionsTable.serverId, runner.serverId),
                eq(preparedActionsTable.proposerAgentId, runner.agentId),
                eq(preparedActionsTable.nonce, nonce)
            )
        )
        .limit(1);
    return row ?? null;
}

export async function assertIdempotentProposal(
    db: Pick<GrottoDatabase, 'select'>,
    existing: Awaited<ReturnType<typeof readActionByNonce>>,
    input: {
        action: AgentCreateActionInput;
        avatar: PreparedActionAvatarBytes;
        chatId: string;
    }
) {
    if (!existing) {
        return;
    }
    const stored = isJsonObject(existing.proposal) ? existing.proposal : null;
    const { avatarMediaId: _storedMediaId, ...storedAction } = stored ?? {};
    const [media] = await db
        .select({
            byteSize: preparedActionMediaTable.byteSize,
            bytes: preparedActionMediaTable.bytes,
            mediaType: preparedActionMediaTable.mediaType,
            sha256: preparedActionMediaTable.sha256,
        })
        .from(preparedActionMediaTable)
        .where(eq(preparedActionMediaTable.actionId, existing.id))
        .limit(1);
    if (
        existing.chatId !== input.chatId ||
        !(media && isDeepStrictEqual(storedAction, input.action)) ||
        media.byteSize !== input.avatar.bytes.byteLength ||
        media.mediaType !== input.avatar.mediaType ||
        media.sha256 !== createHash('sha256').update(input.avatar.bytes).digest('hex') ||
        !Buffer.from(media.bytes).equals(Buffer.from(input.avatar.bytes))
    ) {
        throw new PreparedActionConflictError();
    }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
