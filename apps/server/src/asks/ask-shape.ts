import { type Ask, askSchema } from '@grotto/api';
import { and, eq, inArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { asksTable } from '../postgres/schema.ts';

type AskRow = typeof asksTable.$inferSelect;
type AskReader = Pick<GrottoDatabase, 'select'>;

export function toAsk(row: AskRow): Ask {
    return askSchema.parse({
        addresseeUserId: row.addresseeUserId,
        agentId: row.agentId,
        answerMessageId: row.answerMessageId,
        answeredAt: row.answeredAt?.toISOString() ?? null,
        answeredBy: readAnsweredBy(row),
        chatId: row.chatId,
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        messageId: row.messageId,
        recommendedStep: row.recommendedStep,
        status: row.status,
        summary: row.summary,
        title: row.title,
    });
}

export async function findAskByMessage(
    db: AskReader,
    serverId: string,
    messageId: string
): Promise<Ask | null> {
    const [row] = await db
        .select()
        .from(asksTable)
        .where(and(eq(asksTable.serverId, serverId), eq(asksTable.messageId, messageId)))
        .limit(1);
    return row ? toAsk(row) : null;
}

export async function readAsksForMessages(
    db: AskReader,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, Ask>> {
    if (messageIds.length === 0) {
        return new Map();
    }
    const rows = await db
        .select()
        .from(asksTable)
        .where(and(eq(asksTable.serverId, serverId), inArray(asksTable.messageId, messageIds)));
    return new Map(rows.map((row) => [row.messageId, toAsk(row)]));
}

function readAnsweredBy(row: AskRow): Ask['answeredBy'] {
    if (row.answeredByUserId) {
        return { id: row.answeredByUserId, kind: 'user' };
    }
    if (row.answeredByAgentId) {
        return { id: row.answeredByAgentId, kind: 'agent' };
    }
    return null;
}
