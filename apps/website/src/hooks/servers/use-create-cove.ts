import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Owns the one external operation that reserves or retries Cove application. */
export function useCreateCove() {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.server.createCove.useMutation({
        onSuccess: async (result) => {
            await Promise.all([
                utils.server.bySlug.invalidate(),
                utils.agent.list.invalidate({ serverId: result.agent.serverId }),
            ]);
        },
    });
}
