import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export interface ChatSearchFilters {
    /** Only messages created at or after this instant. */
    after?: string;
    authorAgentId?: string;
    authorUserId?: string;
    chatId?: string;
}

export function useChatSearch(
    serverId: string | undefined,
    query: string,
    filters: ChatSearchFilters = {}
) {
    return hausTrpc.chat.search.useQuery(
        { ...filters, query, serverId: serverId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && query.length > 0,
        }
    );
}
