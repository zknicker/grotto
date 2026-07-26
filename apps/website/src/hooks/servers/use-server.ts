import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** One Grotto server opened at its human-facing address, with its Channels. */
export function useServer(slug: string) {
    return grottoTrpc.server.bySlug.useQuery({ slug }, queryPolicy.syncedSnapshot);
}
