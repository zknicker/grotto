import { hausTrpc } from '../../lib/haus-server.tsx';

/** Creates a Haus server; the creator becomes its first Owner. */
export function useCreateServer() {
    const utils = hausTrpc.useUtils();

    return hausTrpc.server.create.useMutation({
        onSuccess: () => utils.server.list.invalidate(),
    });
}
