import type { MessageBody } from '@grotto/api';
import { readAsksForMessages } from '../asks/ask-shape.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';

/**
 * Projects every typed Message body for one page of Messages. This is the one
 * place a Server record becomes a `Message.body`, so Chat history, Threads,
 * search, and Task rows all read the same projection.
 */
export async function readMessageBodies(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, MessageBody>> {
    const asks = await readAsksForMessages(db, serverId, messageIds);
    return new Map([...asks].map(([messageId, ask]) => [messageId, { ask, kind: 'ask' } as const]));
}
