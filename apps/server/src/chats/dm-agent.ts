import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatsTable } from '../postgres/schema.ts';

/** Resolves the Agent seated in a DM chat, if any. */
export async function readDmAgentId(
    db: GrottoDatabase,
    serverId: string,
    chatId: string
): Promise<string | null> {
    const [chat] = await db
        .select({ dmAgentId: chatsTable.dmAgentId, kind: chatsTable.kind })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, serverId), eq(chatsTable.id, chatId)))
        .limit(1);
    return chat?.kind === 'dm' ? (chat.dmAgentId ?? null) : null;
}
