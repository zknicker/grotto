import { Label, ListBox, Select } from '@heroui/react';
import * as React from 'react';
import { useAssignServerTask } from '../../../hooks/servers/use-assign-server-task.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useServerTaskAssignees } from '../../../hooks/servers/use-server-task-assignees.ts';
import { serverTaskAssignmentInput } from './server-task-control-input.ts';
import type { ServerTask } from './server-task-presentation.ts';
import { useServerAssigneeName } from './use-server-assignee-name.ts';

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
    const humans = useHumanDirectory(serverId);
    const assigneeName = useServerAssigneeName(serverId);
    const agentValue = task.assigneeAgentId ? `agent:${task.assigneeAgentId}` : null;
    const value = agentValue ?? task.assigneeUserId ?? 'unassigned';
    const valueLabel = assigneeName(task);

    if (!enabled) {
        return null;
    }

    return (
        <>
            <Select
                aria-label={`Assignee for task #${task.number}`}
                isDisabled={assign.isPending || (open && assignees.isPending)}
                onChange={(next) => {
                    const userId = String(next);
                    if (!userId || userId.startsWith('agent:')) {
                        return;
                    }
                    const assigneeUserId = userId === 'unassigned' ? null : userId;
                    if (assigneeUserId !== task.assigneeUserId) {
                        assign.mutate(serverTaskAssignmentInput(serverId, task, assigneeUserId));
                    }
                }}
                onOpenChange={setOpen}
                value={value}
                variant="secondary"
            >
                <Select.Trigger>
                    <Select.Value>{valueLabel}</Select.Value>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {agentValue ? (
                            <ListBox.Item id={agentValue} isDisabled textValue={valueLabel}>
                                <Label>{valueLabel}</Label>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ) : null}
                        <ListBox.Item id="unassigned" textValue="Unassigned">
                            <Label>Unassigned</Label>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                        {assignees.data?.map((assignee) => (
                            <ListBox.Item
                                id={assignee.userId}
                                key={assignee.userId}
                                textValue={`${humans.name(assignee.userId)} · ${assignee.role}`}
                            >
                                <Label>
                                    {humans.name(assignee.userId)} · {assignee.role}
                                </Label>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            {assignees.error || assign.error ? (
                <span className="basis-full text-danger text-xs" role="alert">
                    {(assignees.error ?? assign.error)?.message}
                </span>
            ) : null}
        </>
    );
}
