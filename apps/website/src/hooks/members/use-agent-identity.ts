import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { withSavingToast } from '../../lib/saving-toast.ts';
import { refreshAgent } from './agent-refresh.ts';

export function useAgentIdentity(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.agent.updateProfile.useMutation({
        onSuccess: () => refreshAgent(utils, serverId, agentId),
    });

    return {
        ...mutation,
        save: async (identity: { description: string; displayName: string }) => {
            await withSavingToast(() =>
                mutation.mutateAsync({
                    agentId,
                    description: identity.description.trim() || null,
                    displayName: identity.displayName.trim(),
                    serverId,
                })
            );
        },
    };
}
