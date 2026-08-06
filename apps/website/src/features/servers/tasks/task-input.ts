import type { GrottoInputs } from '../../../lib/grotto-server.tsx';

interface VersionedTask {
    id: string;
    version: number;
}

export function taskAssignmentInput(
    serverId: string,
    task: VersionedTask,
    assigneeUserId: string | null
): GrottoInputs['task']['assign'] {
    return {
        assigneeUserId,
        expectedVersion: task.version,
        messageId: task.id,
        serverId,
    };
}

export function taskUpdateInput(
    serverId: string,
    task: VersionedTask,
    patch: GrottoInputs['task']['update']['patch']
): GrottoInputs['task']['update'] {
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
