import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useSendServerChatMessage() {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.send.useMutation({
        onSuccess: async (result, input) => {
            const chatIds = [input.chatId, ...(result.threadChatId ? [result.threadChatId] : [])];
            await Promise.all([
                utils.chat.list.invalidate({ serverId: input.serverId }),
                ...chatIds.map((chatId) =>
                    utils.chat.messages.invalidate({
                        chatId,
                        serverId: input.serverId,
                    })
                ),
                utils.chat.search.invalidate(),
            ]);
        },
    });
}
