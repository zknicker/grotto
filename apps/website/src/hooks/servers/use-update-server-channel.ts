import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useUpdateServerChannel() {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.updateChannel.useMutation({
        onSuccess: async (channel) => {
            await Promise.all([
                utils.chat.list.invalidate({ serverId: channel.serverId }),
                utils.chat.mentionOptions.invalidate({
                    chatId: channel.id,
                    serverId: channel.serverId,
                }),
            ]);
        },
    });
}
