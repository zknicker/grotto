import { trpc } from '../../lib/trpc.tsx';

export function useChatEvents() {
    const utils = trpc.useUtils();
    const handlers = createChatEventHandlers(utils);

    trpc.chat.onUpdate.useSubscription(undefined, {
        onData: handlers.onChatUpdate,
    });

    trpc.chat.log.onUpdate.useSubscription(undefined, {
        onData: handlers.onChatLogUpdate,
    });
}

type ChatEventUtils = Pick<ReturnType<typeof trpc.useUtils>, 'agent' | 'chat'>;

export function createChatEventHandlers(utils: ChatEventUtils) {
    return {
        onChatLogUpdate: (event: unknown) => {
            const chatId = readStringField(event, 'chatId');

            // Agent-authored workspace files can change during any turn. The
            // chat log event is the Runtime's completion signal for that work,
            // so refresh file reads without an ambient polling loop.
            void utils.agent.workspaceReadableFile.invalidate();

            if (chatId) {
                void utils.chat.log.list.invalidate({ id: chatId });
                void utils.chat.files.list.invalidate({ chatId });
                return;
            }

            void utils.chat.log.list.invalidate();
            void utils.chat.files.list.invalidate();
        },
        onChatUpdate: (event: unknown) => {
            const chatId = readStringField(event, 'chatId');

            void utils.agent.chats.list.invalidate();
            void utils.chat.list.invalidate();
            void utils.chat.listArchived.invalidate();

            if (chatId) {
                void utils.chat.get.invalidate({ chatId });
                return;
            }

            void utils.chat.get.invalidate();
        },
    };
}

function readStringField(input: unknown, field: string) {
    if (!(input && typeof input === 'object' && field in input)) {
        return null;
    }

    const value = (input as Record<string, unknown>)[field];

    return typeof value === 'string' ? value : null;
}
