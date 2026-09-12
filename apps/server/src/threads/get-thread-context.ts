import type { HausDatabase } from '../postgres/connection.ts';
import type { HausUser } from '../users/haus-user.ts';
import { requireThreadAccess } from './resolve-thread-access.ts';

export async function getThreadContext(
    db: HausDatabase,
    member: HausUser | null,
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
