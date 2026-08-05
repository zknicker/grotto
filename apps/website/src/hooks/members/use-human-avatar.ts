import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { refreshMember } from './member-refresh.ts';

export function useHumanAvatar(serverId: string, userId: string) {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.avatar.set.useMutation({
        onSuccess: () => refreshMember(utils, serverId, userId),
    });
}
