import { trpc } from '../../lib/trpc.tsx';
import { createChatSendMutationHandlers } from './chat-send-mutation.ts';
import { useChatTimelineStore } from './use-chat-timeline-store.tsx';

export function useChatSend() {
    const utils = trpc.useUtils();
    const timeline = useChatTimelineStore();

    return trpc.chat.send.useMutation(
        createChatSendMutationHandlers({
            chat: utils.chat,
            timelineMessage: {
                add: ({ attachments, chatId, ...input }) => {
                    timeline.addMessage({
                        attachments,
                        ...input,
                        chatId,
                    });
                },
                remove: ({ chatId, messageId }) => {
                    timeline.removeMessage({
                        chatId,
                        messageId,
                    });
                },
            },
            session: utils.session,
        })
    );
}
