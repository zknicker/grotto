import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** The Haus servers the signed-in human can open and switch between. */
export function useServerList() {
    return hausTrpc.server.list.useQuery(undefined, queryPolicy.syncedSnapshot);
}
