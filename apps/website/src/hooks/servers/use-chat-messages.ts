import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useChatMessages(serverId: string | undefined, chatId: string | undefined) {
    return hausTrpc.chat.messages.useQuery(
        { chatId: chatId ?? '', serverId: serverId ?? '' },
        {
            ...queryPolicy.syncedSnapshot,
            enabled: serverId !== undefined && chatId !== undefined,
        }
    );
}
