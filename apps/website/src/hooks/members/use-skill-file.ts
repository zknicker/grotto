import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useSkillFile(serverId: string, agentId: string, name: string, enabled: boolean) {
    return grottoTrpc.agent.skillFile.useQuery({ agentId, name, serverId }, { enabled });
}
