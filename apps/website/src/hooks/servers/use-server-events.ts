import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Keeps the open Grotto server current while it changes on the Server. */
export function useServerEvents(serverId: string | undefined) {
    const utils = grottoTrpc.useUtils();

    grottoTrpc.server.onUpdate.useSubscription(
        { serverId: serverId ?? '' },
        {
            enabled: serverId !== undefined,
            onData: () => {
                void utils.server.bySlug.invalidate();
                void utils.server.list.invalidate();
            },
        }
    );
}
