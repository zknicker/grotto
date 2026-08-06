import { Label, ListBox, Select } from '@heroui/react';
import * as React from 'react';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useTaskAssign } from '../../../hooks/servers/use-task-assign.ts';
import { useTaskAssignees } from '../../../hooks/servers/use-task-assignees.ts';
import { useHostedServerContext } from '../hosted-server-context.ts';
import { taskAssignmentInput } from './task-input.ts';
import type { TaskItem } from './task-model.ts';

export function TaskAssignee({ task }: { task: TaskItem }) {
    const { server } = useHostedServerContext();
    const humans = useHumanDirectory(server.id);
    const canAssign = server.role === 'owner' || server.role === 'admin';
    const [open, setOpen] = React.useState(false);
    const assignees = useTaskAssignees(server.id, task.id, canAssign && open);
    const assign = useTaskAssign();
    const agentValue = task.assigneeAgentId ? `agent:${task.assigneeAgentId}` : null;
    const value = agentValue ?? task.assigneeUserId ?? 'unassigned';
    const valueLabel = task.assigneeLabel;

    if (!canAssign) {
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
                        assign.mutate(taskAssignmentInput(server.id, task, assigneeUserId));
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
