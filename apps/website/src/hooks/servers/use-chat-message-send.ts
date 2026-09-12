import { hausTrpc } from '../../lib/haus-server.tsx';

export function useChatMessageSend() {
    const utils = hausTrpc.useUtils();

    return hausTrpc.chat.send.useMutation({
        // The chat.onEvent listener owns cache invalidation for a send —
        // chat.list, chat.search, and every affected transcript. This is only
        // the sender's ack fallback for when its own durable event is slow, so
        // it is never awaited: the composer has already cleared and the
        // transcript's pending row is carrying the message.
        onSuccess: (result, input) => {
            const chatIds = [
                result.message.chatId,
                ...(result.threadChatId ? [result.threadChatId] : []),
            ];

            for (const chatId of chatIds) {
                void utils.chat.messages.invalidate({ chatId, serverId: input.serverId });
            }
        },
    });
}
