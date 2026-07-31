import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import type { HostedChatMessage } from '@tavern/api';
import { getQueryKey } from '@trpc/react-query';
import * as React from 'react';
import { type GrottoOutputs, grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useServerThreadMessages(
    serverId: string | undefined,
    threadChatId: string | undefined
) {
    const utils = grottoTrpc.useUtils();
    const input = {
        chatId: threadChatId ?? '',
        limit: 50,
        serverId: serverId ?? '',
    };
    const queryKey = getQueryKey(grottoTrpc.chat.messages, input, 'infinite');
    const query = useInfiniteQuery<
        HostedThreadMessagePage,
        Error,
        InfiniteData<HostedThreadMessagePage>,
        typeof queryKey,
        number | undefined
    >({
        ...queryPolicy.syncedSnapshot,
        enabled: serverId !== undefined && threadChatId !== undefined,
        getNextPageParam: (lastPage) => lastPage.nextBeforeSequence ?? undefined,
        initialPageParam: undefined as number | undefined,
        queryFn: async ({ pageParam }) =>
            await utils.client.chat.messages.query({
                ...input,
                ...(pageParam === undefined ? {} : { beforeSequence: pageParam }),
            }),
        queryKey,
        refetchOnMount: true,
    });
    const messages = React.useMemo(
        () => mergeHostedThreadMessagePages(query.data?.pages),
        [query.data?.pages]
    );

    return {
        ...query,
        fetchOlderHistory: query.fetchNextPage,
        hasOlderHistory: Boolean(query.hasNextPage),
        isFetchingOlderHistory: query.isFetchingNextPage,
        messages,
    };
}

type HostedThreadMessagePage = GrottoOutputs['chat']['messages'];

export function mergeHostedThreadMessagePages(
    pages: Array<{ messages: HostedChatMessage[] }> | undefined
) {
    const messagesById = new Map<string, HostedChatMessage>();

    for (let index = (pages?.length ?? 0) - 1; index >= 0; index -= 1) {
        for (const message of pages?.[index]?.messages ?? []) {
            messagesById.set(message.id, message);
        }
    }

    return [...messagesById.values()];
}
