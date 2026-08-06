import { useNavigate } from 'react-router-dom';
import { serversRoute } from '../../features/servers/server-routes.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/**
 * The membership mutations for one workspace. Each one owns the exact
 * invalidation its change implies, so no component decides what to refetch: a
 * role change and a departure both alter the directory and the viewer's own
 * standing, and a departure also changes which Chats they can open.
 */
export function useMembershipActions(serverId: string | undefined) {
    const utils = grottoTrpc.useUtils();
    const navigate = useNavigate();

    const refreshMembership = async () => {
        await Promise.all([
            utils.member.list.invalidate(),
            utils.server.bySlug.invalidate(),
            utils.server.list.invalidate(),
        ]);
    };

    const refreshAfterDeparture = async () => {
        await Promise.all([refreshMembership(), utils.chat.list.invalidate()]);
    };

    return {
        changeRole: grottoTrpc.member.changeRole.useMutation({ onSuccess: refreshMembership }),
        leave: grottoTrpc.member.leave.useMutation({
            onSuccess: async () => {
                await refreshAfterDeparture();
                navigate(serversRoute);
            },
        }),
        remove: grottoTrpc.member.remove.useMutation({ onSuccess: refreshAfterDeparture }),
        serverId,
    };
}
