import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export function useHostedChat(serverId: string, chatId: string) {
    return grottoTrpc.chat.get.useQuery(
        { chatId, serverId },
        { ...queryPolicy.syncedSnapshot, enabled: Boolean(chatId) }
    );
}
