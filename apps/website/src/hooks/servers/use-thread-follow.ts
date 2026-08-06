import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useThreadFollow(parentChatId: string) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.thread.setFollow.useMutation({
        onSuccess: async (_, input) => {
            await Promise.all([
                utils.chat.list.invalidate({ serverId: input.serverId }),
                utils.chat.messages.invalidate({
                    chatId: parentChatId,
                    serverId: input.serverId,
                }),
            ]);
        },
    });
}
