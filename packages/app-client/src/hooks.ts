import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import * as React from 'react';
import { grottoTrpc } from './grotto-client.tsx';
import { queryPolicy } from './query-policy.ts';

export function useServerList() {
    return grottoTrpc.server.list.useQuery(undefined, queryPolicy.syncedSnapshot);
}

export function useServer(slug: string, enabled = true) {
    return grottoTrpc.server.bySlug.useQuery({ slug }, { ...queryPolicy.syncedSnapshot, enabled });
}

export function useChats(serverId: string | undefined) {
    return grottoTrpc.chat.list.useQuery(
        { serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: serverId !== undefined }
    );
}

export function useHostedChat(serverId: string | undefined, chatId: string | undefined) {
    return grottoTrpc.chat.get.useQuery(
        { chatId: chatId ?? '', serverId: serverId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && chatId !== undefined,
        }
    );
}

export function useChatMessages(serverId: string | undefined, chatId: string | undefined) {
    return grottoTrpc.chat.messages.useQuery(
        { chatId: chatId ?? '', serverId: serverId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && chatId !== undefined,
        }
    );
}

type ChatMessagePage = import('./grotto-client.tsx').GrottoOutputs['chat']['messages'];

export function useChatMessagePages(serverId: string | undefined, chatId: string | undefined) {
    const utils = grottoTrpc.useUtils();
    const input = { chatId: chatId ?? '', limit: 50, serverId: serverId ?? '' };
    const queryKey = chatMessagePagesQueryKey(input.serverId, input.chatId);
    const query = useInfiniteQuery<
        ChatMessagePage,
        Error,
        InfiniteData<ChatMessagePage>,
        typeof queryKey,
        number | undefined
    >({
        ...queryPolicy.syncedSnapshot,
        enabled: serverId !== undefined && chatId !== undefined,
        getNextPageParam: (lastPage) => lastPage.nextBeforeSequence ?? undefined,
        initialPageParam: undefined as number | undefined,
        queryFn: async ({ pageParam }) =>
            await utils.client.chat.messages.query({
                ...input,
                ...(pageParam === undefined ? {} : { beforeSequence: pageParam }),
            }),
        queryKey,
    });
    const messages = React.useMemo(
        () => mergeChatMessagePages(query.data?.pages),
        [query.data?.pages]
    );
    const threads = React.useMemo(
        () => query.data?.pages.flatMap((page) => page.threads) ?? [],
        [query.data?.pages]
    );

    return {
        ...query,
        fetchOlderHistory: query.fetchNextPage,
        hasOlderHistory: Boolean(query.hasNextPage),
        isFetchingOlderHistory: query.isFetchingNextPage,
        messages,
        threads,
    };
}

export function chatMessagePagesQueryKey(serverId: string, chatId: string) {
    return getQueryKey(grottoTrpc.chat.messages, { chatId, limit: 50, serverId }, 'infinite');
}

export function mergeChatMessagePages<Message extends { id: string }>(
    pages: Array<{ messages: Message[] }> | undefined
) {
    const messagesById = new Map<string, Message>();

    for (let index = (pages?.length ?? 0) - 1; index >= 0; index -= 1) {
        for (const message of pages?.[index]?.messages ?? []) {
            messagesById.set(message.id, message);
        }
    }

    return [...messagesById.values()];
}

export function useChatMessageSend() {
    const queryClient = useQueryClient();
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.chat.send.useMutation({
        onSuccess: (result, input) => {
            const chatIds = [input.chatId, ...(result.threadChatId ? [result.threadChatId] : [])];

            for (const chatId of chatIds) {
                void utils.chat.messages.invalidate({ chatId, serverId: input.serverId });
                void queryClient.invalidateQueries({
                    queryKey: chatMessagePagesQueryKey(input.serverId, chatId),
                });
            }
        },
    });
}

export function useChatRead(input: {
    chatId: string | undefined;
    enabled?: boolean;
    sequence: number | undefined;
    serverId: string | undefined;
}) {
    const mutation = grottoTrpc.chat.markRead.useMutation();
    const mutate = mutation.mutate;
    const lastMarkedRef = React.useRef<string | null>(null);
    const viewKey =
        (input.enabled ?? true) &&
        input.chatId !== undefined &&
        input.sequence !== undefined &&
        input.serverId !== undefined
            ? `${input.serverId}:${input.chatId}:${input.sequence}`
            : null;

    React.useEffect(() => {
        if (!viewKey || viewKey === lastMarkedRef.current) {
            return;
        }

        lastMarkedRef.current = viewKey;
        mutate({
            chatId: input.chatId as string,
            sequence: input.sequence as number,
            serverId: input.serverId as string,
        });
    }, [input.chatId, input.sequence, input.serverId, mutate, viewKey]);

    return mutation;
}

export function useAgents(serverId: string | undefined) {
    return grottoTrpc.agent.list.useQuery(
        { serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: serverId !== undefined }
    );
}

export function useAgent(serverId: string | undefined, agentId: string | undefined) {
    return grottoTrpc.agent.get.useQuery(
        { agentId: agentId ?? '', serverId: serverId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && agentId !== undefined,
        }
    );
}

export function useAgentProfileUpdate(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.agent.updateProfile.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.agent.get.invalidate({ agentId, serverId }),
                utils.agent.list.invalidate({ serverId }),
            ]);
        },
    });

    return {
        ...mutation,
        save: async (profile: { description: string; displayName: string }) =>
            await mutation.mutateAsync({
                agentId,
                description: profile.description.trim() || null,
                displayName: profile.displayName.trim(),
                serverId,
            }),
    };
}

export function useAgentAvatarUpdate(serverId: string, agentId: string) {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.avatar.set.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.agent.get.invalidate({ agentId, serverId }),
                utils.agent.list.invalidate({ serverId }),
            ]);
        },
    });
}

export function useMembers(serverId: string | undefined, options?: { enabled?: boolean }) {
    return grottoTrpc.member.list.useQuery(
        { serverId: serverId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && options?.enabled !== false,
        }
    );
}

export function useMember(serverId: string | undefined, userId: string | undefined) {
    return grottoTrpc.member.get.useQuery(
        { serverId: serverId ?? '', userId: userId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && userId !== undefined,
        }
    );
}

export function useMemberProfileUpdate(serverId: string, userId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.member.updateProfile.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.member.get.invalidate({ serverId, userId }),
                utils.member.list.invalidate({ serverId }),
            ]);
        },
    });

    return {
        ...mutation,
        save: async (profile: { description: string; displayName: string }) =>
            await mutation.mutateAsync({
                description: profile.description.trim() || null,
                displayName: profile.displayName.trim(),
            }),
    };
}

export function useMemberAvatarUpdate(serverId: string, userId: string) {
    const utils = grottoTrpc.useUtils();
    return grottoTrpc.avatar.set.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.member.get.invalidate({ serverId, userId }),
                utils.member.list.invalidate({ serverId }),
            ]);
        },
    });
}
