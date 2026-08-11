import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useCreateServerChannel() {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.createChannel.useMutation({
        // The chat.lifecycle `created` event owns list invalidation; this is
        // the creator's un-awaited ack fallback so navigation never waits.
        onSuccess: (channel) => {
            void utils.chat.list.invalidate({ serverId: channel.serverId });
        },
    });
}
