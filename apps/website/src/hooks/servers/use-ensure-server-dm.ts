import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useEnsureServerDm(onOpenChat: (chatId: string) => void) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.ensureDm.useMutation({
        onSuccess: async (chat) => {
            await utils.chat.list.invalidate({ serverId: chat.serverId });
            onOpenChat(chat.id);
        },
    });
}
