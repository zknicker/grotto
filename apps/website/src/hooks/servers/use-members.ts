import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** The humans in one workspace, with the viewer's own identity and role. */
export function useMembers(serverId: string | undefined, options?: { enabled?: boolean }) {
    return grottoTrpc.member.list.useQuery(
        { serverId: serverId ?? '' },
        { enabled: serverId !== undefined && options?.enabled !== false }
    );
}
