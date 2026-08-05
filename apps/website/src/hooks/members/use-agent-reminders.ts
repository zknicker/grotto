import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useAgentReminders(serverId: string, agentId: string, enabled: boolean) {
    return grottoTrpc.reminder.list.useQuery({ agentId, serverId }, { enabled });
}
