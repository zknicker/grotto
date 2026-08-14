import type { ChatMessageAttachmentInput } from '../../lib/trpc.tsx';

export interface ChatSendMutationContext {
    timelineChatId: string | null;
    timelineMessageId: string;
}

export interface ChatSendMutationUtils {
    chat: {
        get: {
            invalidate: (input: { chatId: string }) => Promise<unknown>;
        };
        list: {
            invalidate: () => Promise<unknown>;
        };
        log: {
            list: {
                invalidate: () => Promise<unknown>;
            };
        };
    };
    session: {
        get: {
            invalidate: () => Promise<unknown>;
        };
        history: {
            get: {
                invalidate: () => Promise<unknown>;
            };
        };
        list: {
            invalidate: () => Promise<unknown>;
        };
    };
    timelineMessage: {
        add: (input: {
            attachments?: ChatMessageAttachmentInput[];
            chatId: string;
            content: string;
            id: string;
            metadata?: Record<string, unknown>;
            timestamp: string;
        }) => void;
        remove: (input: { chatId: string; messageId: string }) => void;
    };
}

// Sends create the durable message only; agent delivery is planner-owned
// (specs/chat-timeline.md) — the runtime's inbox delivery queues the message
// per attention rules and wakes agents itself, so there is no turn to track
// optimistically here.
export function createChatSendMutationHandlers(utils: ChatSendMutationUtils) {
    return {
        onMutate: async (input: {
            attachments?: ChatMessageAttachmentInput[];
            chatId: string;
            clientMessageId?: string;
            content: string;
            thread?: { anchorMessageId: string };
        }) => {
            const timestamp = new Date().toISOString();
            const timelineMessageId = input.clientMessageId ?? `msg_${crypto.randomUUID()}`;
            if (input.thread) {
                return {
                    timelineChatId: null,
                    timelineMessageId,
                } satisfies ChatSendMutationContext;
            }

            utils.timelineMessage.add({
                ...(input.attachments?.length ? { attachments: input.attachments } : {}),
                chatId: input.chatId,
                content: input.content,
                id: timelineMessageId,
                timestamp,
            });

            return {
                timelineChatId: input.chatId,
                timelineMessageId,
            } satisfies ChatSendMutationContext;
        },
        onError: (
            _error: unknown,
            _input: { chatId: string },
            context: ChatSendMutationContext | undefined
        ) => {
            if (context?.timelineChatId) {
                utils.timelineMessage.remove({
                    chatId: context.timelineChatId,
                    messageId: context.timelineMessageId,
                });
            }
        },
        onSuccess: async (result: { chatId: string }) => {
            await Promise.all([
                utils.chat.get.invalidate({ chatId: result.chatId }),
                utils.chat.list.invalidate(),
                utils.chat.log.list.invalidate(),
                utils.session.list.invalidate(),
            ]);
        },
    };
}
