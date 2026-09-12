import { hausTrpc } from '../../lib/haus-server.tsx';

export function useCreateServerChannel() {
    const utils = hausTrpc.useUtils();

    return hausTrpc.chat.createChannel.useMutation({
        // The chat.lifecycle `created` event owns list invalidation; this is
        // the creator's un-awaited ack fallback so navigation never waits.
        onSuccess: (channel) => {
            void utils.chat.list.invalidate({ serverId: channel.serverId });
        },
    });
}
