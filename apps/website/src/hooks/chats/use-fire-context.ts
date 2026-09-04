import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/**
 * Why one message was sent, read for the Thread that opened it. Authorized by
 * access to the message itself, and `NOT_FOUND` when the message has no cause —
 * so callers ask only for anchors whose `cause` says there is something to read.
 */
export function useFireContext(serverId: string, messageId: string, enabled: boolean) {
    return grottoTrpc.automation.fireContext.useQuery(
        { messageId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
