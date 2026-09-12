import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useChat(serverId: string, chatId: string) {
    return hausTrpc.chat.get.useQuery(
        { chatId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled: Boolean(chatId) }
    );
}
