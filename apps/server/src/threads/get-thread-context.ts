import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireThreadAccess } from './resolve-thread-access.ts';

export async function getThreadContext(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { serverId: string; threadChatId: string }
) {
    const thread = await requireThreadAccess(db, member, input);

    return {
        anchorMessageId: thread.anchorMessageId,
        parentChatId: thread.parentChatId,
        serverId: input.serverId,
        threadChatId: input.threadChatId,
    };
}
