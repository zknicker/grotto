import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { withSavingToast } from '../../lib/saving-toast.ts';
import { refreshMember } from './member-refresh.ts';

export function useHumanIdentity(serverId: string, userId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.member.updateProfile.useMutation({
        onSuccess: () => refreshMember(utils, serverId, userId),
    });

    return {
        ...mutation,
        save: async (identity: { description: string; displayName: string; handle?: string }) => {
            await withSavingToast(() =>
                mutation.mutateAsync({
                    description: identity.description.trim() || null,
                    displayName: identity.displayName.trim(),
                    ...(identity.handle ? { handle: identity.handle.trim() } : {}),
                    serverId,
                })
            );
        },
    };
}
