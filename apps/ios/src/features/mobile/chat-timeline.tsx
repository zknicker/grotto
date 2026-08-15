import { useChatMessagePages, useChatRead } from '@tavern/app-client';
import { Spinner } from 'heroui-native/spinner';
import { Text, View } from 'react-native';
import { MessageTimelineList } from './message-timeline-list.tsx';
import { usePendingMessages } from './pending-messages.ts';

export function ChatTimeline({
    chatId,
    serverId,
}: {
    chatId: string | undefined;
    serverId: string;
}) {
    const messages = useChatMessagePages(serverId, chatId);
    const pendingMessages = usePendingMessages(chatId ?? '', messages.messages);
    useChatRead({
        chatId,
        sequence: messages.messages.at(-1)?.sequence,
        serverId,
    });

    if (!chatId) {
        return <TimelineState copy="No chat selected." />;
    }

    if (messages.isPending && !messages.data) {
        return <TimelineState loading />;
    }

    if (messages.isError && !messages.data) {
        return <TimelineState copy="Messages are unavailable." />;
    }

    return (
        <MessageTimelineList
            hasOlderHistory={messages.hasOlderHistory}
            isFetchingOlderHistory={messages.isFetchingOlderHistory}
            messages={messages.messages}
            onFetchOlder={() => void messages.fetchOlderHistory()}
            parentChatId={chatId}
            pendingMessages={pendingMessages}
            serverId={serverId}
            threads={messages.threads}
        />
    );
}

function TimelineState({ copy, loading = false }: { copy?: string; loading?: boolean }) {
    return (
        <View className="flex-1 items-center justify-center px-8">
            {loading ? <Spinner /> : <Text className="text-center text-muted">{copy}</Text>}
        </View>
    );
}
