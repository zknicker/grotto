/** A hosted query cache whose data can be dropped, not just marked stale. */
export interface ClearableCache {
    reset(): unknown;
}

export interface HostedServerCaches {
    agent: { get: ClearableCache; list: ClearableCache };
    chat: { list: ClearableCache; messages: ClearableCache; search: ClearableCache };
    invitation: { list: ClearableCache };
    member: { get: ClearableCache; list: ClearableCache };
    server: { bySlug: ClearableCache; list: ClearableCache };
    stats: { live: ClearableCache };
    task: { assignees: ClearableCache; list: ClearableCache };
    taskLabel: { list: ClearableCache };
}

/**
 * Every hosted cache that must not outlive membership on one Server.
 *
 * These are cleared rather than invalidated. Invalidating marks data stale and
 * refetches, but the existing data stays readable until the refetch lands — and
 * stays readable indefinitely while offline. For Server data that means a
 * removed human keeps seeing Chats, the member directory, and the Server itself
 * in their list, which is exactly what losing access is supposed to end.
 *
 * The Server list is included deliberately: it is what makes the removed Server
 * openable again from `/s`.
 */
export function cachesClearedOnMembershipLoss(utils: HostedServerCaches): ClearableCache[] {
    return [
        utils.agent.get,
        utils.agent.list,
        utils.server.bySlug,
        utils.server.list,
        utils.member.get,
        utils.member.list,
        utils.invitation.list,
        utils.chat.list,
        utils.chat.messages,
        utils.chat.search,
        utils.task.list,
        utils.task.assignees,
        utils.taskLabel.list,
        utils.stats.live,
    ];
}
