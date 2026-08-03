import * as React from 'react';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';

interface TaskAssignment {
    assigneeAgentId: null | string;
    assigneeUserId: null | string;
}

/**
 * Names a task's assignee the way the rest of the App names them: Agents by
 * display name, humans through the member directory. Both queries are already
 * loaded by the Server layout, so this reads from cache.
 */
export function useServerAssigneeName(serverId: string) {
    const humans = useHumanDirectory(serverId);
    const agents = grottoTrpc.agent.list.useQuery({ serverId }, { enabled: serverId.length > 0 });
    const agentNames = agents.data;

    return React.useCallback(
        (task: TaskAssignment): string => {
            if (task.assigneeAgentId) {
                const agent = agentNames?.find(
                    (candidate) => candidate.id === task.assigneeAgentId
                );
                return agent?.displayName ?? `Agent ${task.assigneeAgentId.slice(-6)}`;
            }
            if (task.assigneeUserId) {
                return humans.name(task.assigneeUserId);
            }
            return 'Unassigned';
        },
        [agentNames, humans]
    );
}
