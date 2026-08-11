import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useDmEnsure(onOpenChat: (chatId: string) => void) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.ensureDm.useMutation({
        // A first DM emits chat.lifecycle `created`, which owns list
        // invalidation; the un-awaited fallback also covers the idempotent
        // reopen branch, which stays silent. Navigation never waits.
        onSuccess: (chat) => {
            void utils.chat.list.invalidate({ serverId: chat.serverId });
            onOpenChat(chat.id);
        },
    });
}
