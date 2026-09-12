import type { hausTrpc } from '../../lib/haus-server.tsx';

type HausUtils = ReturnType<typeof hausTrpc.useUtils>;

export function refreshMember(
    utils: HausUtils,
    serverId: string,
    userId: string
): Promise<unknown[]> {
    return Promise.all([
        utils.member.get.invalidate({ serverId, userId }),
        utils.member.list.invalidate({ serverId }),
    ]);
}
