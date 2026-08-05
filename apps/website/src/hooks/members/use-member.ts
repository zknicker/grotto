import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** One human's current Server profile. */
export function useMember(serverId: string, userId: string | undefined) {
    return grottoTrpc.member.get.useQuery(
        { serverId, userId: userId ?? '' },
        { enabled: userId !== undefined }
    );
}
