import type { HausInputs } from '../../../lib/haus-server.tsx';

interface VersionedTask {
    id: string;
    version: number;
}

export function taskAssignmentInput(
    serverId: string,
    task: VersionedTask,
    assignee: HausInputs['task']['assign']['assignee']
): HausInputs['task']['assign'] {
    return {
        assignee,
        expectedVersion: task.version,
        messageId: task.id,
        serverId,
    };
}

export function taskUpdateInput(
    serverId: string,
    task: VersionedTask,
    patch: HausInputs['task']['update']['patch']
): HausInputs['task']['update'] {
    return {
        expectedVersion: task.version,
        messageId: task.id,
        patch,
        serverId,
    };
}

export function toggledTaskLabelIds(currentIds: string[], labelId: string, selected: boolean) {
    if (selected) {
        return currentIds.includes(labelId) ? currentIds : [...currentIds, labelId];
    }
    return currentIds.filter((id) => id !== labelId);
}
