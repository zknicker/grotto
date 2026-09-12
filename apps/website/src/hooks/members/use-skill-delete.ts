import { hausTrpc } from '../../lib/haus-server.tsx';

export function useSkillDelete(serverId: string, agentId: string, name: string) {
    const utils = hausTrpc.useUtils();
    const mutation = hausTrpc.agent.deleteSkillFile.useMutation();

    return {
        ...mutation,
        deleteSkill: async (expectedHash: string) => {
            await mutation.mutateAsync({ agentId, expectedHash, name, serverId });
            await utils.computer.list.invalidate({ serverId });
        },
    };
}
