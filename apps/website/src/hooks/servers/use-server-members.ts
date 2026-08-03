import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** The humans on one Grotto server, with the viewer's own identity and role. */
export function useServerMembers(serverId: string | undefined, options?: { enabled?: boolean }) {
    return grottoTrpc.member.list.useQuery(
        { serverId: serverId ?? '' },
        { enabled: serverId !== undefined && options?.enabled !== false }
    );
}
