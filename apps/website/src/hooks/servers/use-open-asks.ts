import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/**
 * The viewer's open Asks on one Server, oldest first. Server membership and
 * Chat access gate the read, so an Ask the viewer lost access to simply stops
 * arriving; the Inbox never has to filter one out.
 */
export function useOpenAsks(serverId: string | undefined) {
    return grottoTrpc.ask.listOpen.useQuery(
        { serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: serverId !== undefined }
    );
}
