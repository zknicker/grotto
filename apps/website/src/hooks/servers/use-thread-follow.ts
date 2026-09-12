import { hausTrpc } from '../../lib/haus-server.tsx';

export function useThreadFollow(parentChatId: string) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.thread.setFollow.useMutation({
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
