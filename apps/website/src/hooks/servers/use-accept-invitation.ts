import { useNavigate } from 'react-router-dom';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** What an invited human may see before accepting. */
export function useInvitationPreview(token: string) {
    return grottoTrpc.invitation.preview.useQuery({ token }, { enabled: token.length > 0 });
}

/** Accepting lands the human in the Server they were invited to. */
export function useAcceptInvitation() {
    const utils = grottoTrpc.useUtils();
    const navigate = useNavigate();

    return grottoTrpc.invitation.accept.useMutation({
        onSuccess: async (accepted) => {
            await utils.server.list.invalidate();
            navigate(serverRoute(accepted.serverSlug));
        },
    });
}
