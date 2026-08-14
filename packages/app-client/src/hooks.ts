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

export function useAgents(serverId: string | undefined) {
    return grottoTrpc.agent.list.useQuery(
        { serverId: serverId ?? '' },
        { ...queryPolicy.syncedSnapshot, enabled: serverId !== undefined }
    );
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
