import type { PreparedActionCommitInput } from '@grotto/api';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function usePreparedActionCommit(serverId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.preparedAction.commit.useMutation();

    return {
        ...mutation,
        commit: async (input: PreparedActionCommitInput) => {
            const result = await mutation.mutateAsync(input);
            await Promise.all([
                utils.agent.list.invalidate({ serverId }),
                utils.chat.list.invalidate({ serverId }),
                utils.chat.messages.invalidate({
                    chatId: result.action.chatId,
                    serverId,
                }),
            ]);
            return result;
        },
    };
}
