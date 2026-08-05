import type { HostedCreateAgentInput } from '@tavern/api';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgentCreate(serverId: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.agent.create.useMutation();

    return {
        ...mutation,
        createAgent: async (input: HostedCreateAgentInput) => {
            const result = await mutation.mutateAsync(input);
            await Promise.all([
                utils.agent.list.invalidate({ serverId }),
                utils.chat.list.invalidate({ serverId }),
            ]);
            return result;
        },
    };
}
