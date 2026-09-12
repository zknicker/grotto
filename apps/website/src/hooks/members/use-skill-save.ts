import { hausTrpc } from '../../lib/haus-server.tsx';

export function useSkillSave(serverId: string, agentId: string, name: string) {
    const utils = hausTrpc.useUtils();
    const input = { agentId, name, serverId };
    const mutation = hausTrpc.agent.updateSkillFile.useMutation();

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
