import type { grottoTrpc } from '../../lib/grotto-server.tsx';

type GrottoUtils = ReturnType<typeof grottoTrpc.useUtils>;

export function refreshMember(
    utils: GrottoUtils,
    serverId: string,
    userId: string
): Promise<unknown[]> {
    return Promise.all([
        utils.member.get.invalidate({ serverId, userId }),
        utils.member.list.invalidate({ serverId }),
    ]);
}
