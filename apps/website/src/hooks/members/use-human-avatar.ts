import { hausTrpc } from '../../lib/haus-server.tsx';
import { refreshMember } from './member-refresh.ts';

export function useHumanAvatar(serverId: string, userId: string) {
    const utils = hausTrpc.useUtils();
    return hausTrpc.avatar.set.useMutation({
        onSuccess: () => refreshMember(utils, serverId, userId),
    });
}
