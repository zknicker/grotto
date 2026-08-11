import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/** Invitations an Owner or Admin may see. Never includes a token. */
export function useServerInvitations(serverId: string | undefined, enabled: boolean) {
    return grottoTrpc.invitation.list.useQuery(
        { serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: enabled && serverId !== undefined }
    );
}

/** Issuing and revoking invitations, both refreshing the same list. */
export function useServerInvitationCommands() {
    const utils = grottoTrpc.useUtils();
    const refresh = () => utils.invitation.list.invalidate();

    return {
        create: grottoTrpc.invitation.create.useMutation({ onSuccess: refresh }),
        revoke: grottoTrpc.invitation.revoke.useMutation({ onSuccess: refresh }),
    };
}
