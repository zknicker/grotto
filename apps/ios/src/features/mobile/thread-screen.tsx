import { useChatMessagePages, useChatRead } from '@tavern/app-client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Spinner } from 'heroui-native/spinner';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppLayout } from './app-layout.tsx';
import { BackHeader } from './back-header.tsx';
import { ThreadComposer } from './composer.tsx';
import { MessageTimelineList } from './message-timeline-list.tsx';
import { threadPendingKey, usePendingMessages } from './pending-messages.ts';

export function ThreadScreen() {
    const params = useLocalSearchParams<{
        id?: string | string[];
        parentChatId?: string | string[];
        serverId?: string | string[];
        threadChatId?: string | string[];
    }>();
    const router = useRouter();
    const anchorMessageId = firstParam(params.id);
    const parentChatId = firstParam(params.parentChatId);
    const serverId = firstParam(params.serverId);
    const routeThreadChatId = firstParam(params.threadChatId);
    const [createdThreadChatId, setCreatedThreadChatId] = useState<string>();
    const threadChatId = routeThreadChatId ?? createdThreadChatId;
    const parentMessages = useChatMessagePages(serverId, parentChatId);
    const replies = useChatMessagePages(serverId, threadChatId);
    const anchor = parentMessages.messages.find((message) => message.id === anchorMessageId);
    const pendingReplies = usePendingMessages(
        anchorMessageId ? threadPendingKey(anchorMessageId) : '',
        replies.messages
    );
    const fetchOlderParentMessages = parentMessages.fetchOlderHistory;
    const hasOlderParentMessages = parentMessages.hasOlderHistory;
    const isFetchingOlderParentMessages = parentMessages.isFetchingOlderHistory;

    useEffect(() => {
        if (
            anchorMessageId &&
            parentChatId &&
            parentMessages.data &&
            !anchor &&
            hasOlderParentMessages &&
            !isFetchingOlderParentMessages
        ) {
            void fetchOlderParentMessages();
        }
    }, [
        anchor,
        anchorMessageId,
        fetchOlderParentMessages,
        hasOlderParentMessages,
        isFetchingOlderParentMessages,
        parentChatId,
        parentMessages.data,
    ]);

    useChatRead({
        chatId: threadChatId,
        sequence: replies.messages.at(-1)?.sequence,
        serverId,
    });

    const invalidIdentity = !(anchorMessageId && parentChatId && serverId);
    const loading =
        !invalidIdentity &&
        (parentMessages.isPending || Boolean(threadChatId && replies.isPending));
    const unavailable =
        invalidIdentity ||
        parentMessages.isError ||
        Boolean(threadChatId && replies.isError) ||
        (parentMessages.data && !anchor && !parentMessages.hasOlderHistory);
    const timelineMessages = [
        ...(anchor && !replies.hasOlderHistory ? [anchor] : []),
        ...replies.messages,
    ];

    return (
        <AppLayout.Root>
            <BackHeader title="Thread" />
            <AppLayout.Content>
                {loading ? (
                    <ThreadState loading />
                ) : unavailable ? (
                    <ThreadState copy="This thread is unavailable." />
                ) : (
                    <MessageTimelineList
                        hasOlderHistory={replies.hasOlderHistory}
                        isFetchingOlderHistory={replies.isFetchingOlderHistory}
                        messages={timelineMessages}
                        onFetchOlder={() => void replies.fetchOlderHistory()}
                        pendingMessages={pendingReplies}
                        serverId={serverId ?? ''}
                        threads={[]}
                    />
                )}
            </AppLayout.Content>
            <AppLayout.Footer>
                {anchor && anchorMessageId && parentChatId && serverId ? (
                    <ThreadComposer
                        anchorMessageId={anchorMessageId}
                        key={anchorMessageId}
                        onThreadCreated={(createdId) => {
                            if (!threadChatId) {
                                setCreatedThreadChatId(createdId);
                                router.setParams({ threadChatId: createdId });
                            }
                        }}
                        parentChatId={parentChatId}
                        serverId={serverId}
                    />
                ) : null}
            </AppLayout.Footer>
        </AppLayout.Root>
    );
}

function ThreadState({ copy, loading = false }: { copy?: string; loading?: boolean }) {
    return (
        <View className="flex-1 items-center justify-center px-8">
            {loading ? <Spinner /> : <Text className="text-center text-muted">{copy}</Text>}
        </View>
    );
}

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}
