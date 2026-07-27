/** A hosted query cache whose data can be dropped, not just marked stale. */
export interface ClearableCache {
    reset(): unknown;
}

export interface HostedServerCaches {
    chat: { list: ClearableCache; messages: ClearableCache; search: ClearableCache };
    invitation: { list: ClearableCache };
    member: { list: ClearableCache };
    server: { bySlug: ClearableCache; list: ClearableCache };
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
        utils.server.bySlug,
        utils.server.list,
        utils.member.list,
        utils.invitation.list,
        utils.chat.list,
        utils.chat.messages,
        utils.chat.search,
    ];
}
