import { hausTrpc } from '../../lib/haus-server.tsx';

/** Owns the one external operation that reserves or retries Cove application. */
export function useCreateCove() {
    const utils = hausTrpc.useUtils();
    return hausTrpc.server.createCove.useMutation({
        onSuccess: async (result) => {
            await Promise.all([
                utils.server.bySlug.invalidate(),
                utils.agent.list.invalidate({ serverId: result.agent.serverId }),
            ]);
        },
    });
}
