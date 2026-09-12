import { hausTrpc } from '../../lib/haus-server.tsx';

export function useSkillImport(serverId: string, agentId: string) {
    const mutation = hausTrpc.agent.importSkill.useMutation();
    return {
        ...mutation,
        importSkill: (sourceId: string) => mutation.mutate({ agentId, serverId, sourceId }),
    };
}
