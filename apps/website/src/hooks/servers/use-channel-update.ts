import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useChannelUpdate() {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.updateChannel.useMutation({
        // The chat.lifecycle `updated` event owns list invalidation. Mention
        // options have no event coverage, so this mutation stays their owner.
        onSuccess: (channel) => {
            void utils.chat.mentionOptions.invalidate({
                chatId: channel.id,
                serverId: channel.serverId,
            });
        },
    });
}
