import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useSkillSave(serverId: string, agentId: string, name: string) {
    const utils = grottoTrpc.useUtils();
    const input = { agentId, name, serverId };
    const mutation = grottoTrpc.agent.updateSkillFile.useMutation();

    return {
        ...mutation,
        save: async (content: string, expectedHash: string) => {
            const updated = await mutation.mutateAsync({ ...input, content, expectedHash });
            utils.agent.skillFile.setData(input, updated);
            await utils.computer.list.invalidate({ serverId });
            return updated;
        },
    };
}
