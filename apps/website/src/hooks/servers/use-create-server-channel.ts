import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useCreateServerChannel() {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.createChannel.useMutation({
        onSuccess: async (channel) => {
            await utils.chat.list.invalidate({ serverId: channel.serverId });
        },
    });
}
