import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Creates a Grotto server; the creator becomes its first Owner. */
export function useCreateServer() {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.server.create.useMutation({
        onSuccess: () => utils.server.list.invalidate(),
    });
}
