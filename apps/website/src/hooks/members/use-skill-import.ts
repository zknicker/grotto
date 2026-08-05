import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useSkillImport(serverId: string, agentId: string) {
    const mutation = grottoTrpc.agent.importSkill.useMutation();
    return {
        ...mutation,
        importSkill: (sourceId: string) => mutation.mutate({ agentId, serverId, sourceId }),
    };
}
