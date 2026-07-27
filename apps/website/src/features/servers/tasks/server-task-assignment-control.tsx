import * as React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { useAssignServerTask } from '../../../hooks/servers/use-assign-server-task.ts';
import { useServerTaskAssignees } from '../../../hooks/servers/use-server-task-assignees.ts';
import { serverTaskAssignmentInput } from './server-task-control-input.ts';
import type { ServerTask } from './server-task-presentation.ts';

export function ServerTaskAssignmentControl({
    enabled,
    serverId,
    task,
}: {
    enabled: boolean;
    serverId: string;
    task: ServerTask;
}) {
    const [open, setOpen] = React.useState(false);
    const assignees = useServerTaskAssignees(serverId, task.id, enabled && open);
    const assign = useAssignServerTask();
    const value = task.assigneeUserId ?? 'unassigned';
    const valueLabel = task.assigneeUserId ? humanLabel(task.assigneeUserId) : 'Unassigned';

    if (!enabled) {
        return null;
    }

    return (
        <>
            <Select
                disabled={assign.isPending || (open && assignees.isPending)}
                onOpenChange={setOpen}
                onValueChange={(userId) => {
                    const next = userId === 'unassigned' ? null : userId;
                    if (next !== task.assigneeUserId) {
                        assign.mutate(serverTaskAssignmentInput(serverId, task, next));
                    }
                }}
                value={value}
            >
                <SelectTrigger aria-label={`Assignee for task #${task.number}`} size="sm">
                    <SelectValue>{valueLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {assignees.data?.map((assignee) => (
                        <SelectItem key={assignee.userId} value={assignee.userId}>
                            {humanLabel(assignee.userId)} · {assignee.role}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {assignees.error || assign.error ? (
                <span className="basis-full text-destructive text-xs" role="alert">
                    {(assignees.error ?? assign.error)?.message}
                </span>
            ) : null}
        </>
    );
}

function humanLabel(userId: string) {
    return `Human ${userId.slice(-6)}`;
}
