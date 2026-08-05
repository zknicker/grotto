import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useSkillDelete(serverId: string, agentId: string, name: string) {
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.agent.deleteSkillFile.useMutation();

    return {
        ...mutation,
        deleteSkill: async (expectedHash: string) => {
            await mutation.mutateAsync({ agentId, expectedHash, name, serverId });
            await utils.computer.list.invalidate({ serverId });
        },
    };
}
