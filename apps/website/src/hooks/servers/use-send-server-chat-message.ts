import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useSendServerChatMessage() {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.send.useMutation({
        onSuccess: async (_, input) => {
            await Promise.all([
                utils.chat.list.invalidate({ serverId: input.serverId }),
                utils.chat.messages.invalidate({
                    chatId: input.chatId,
                    serverId: input.serverId,
                }),
                utils.chat.search.invalidate(),
            ]);
        },
    });
}
