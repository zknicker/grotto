import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** The Grotto servers the signed-in human can open and switch between. */
export function useServerList() {
    return grottoTrpc.server.list.useQuery(undefined, queryPolicy.syncedSnapshot);
}
