import { hausTrpc } from '../../lib/haus-server.tsx';

export function useChannelUpdate() {
    const utils = hausTrpc.useUtils();

    return hausTrpc.chat.updateChannel.useMutation({
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
