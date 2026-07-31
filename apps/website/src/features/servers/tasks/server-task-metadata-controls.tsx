import { Button, Dropdown, Label, ListBox, Select } from '@heroui/react';
import type { HostedTaskLabel } from '@tavern/api';
import type { Key } from 'react';
import { useUpdateServerTask } from '../../../hooks/servers/use-update-server-task.ts';
import { LabelChip } from '../../tasks/label-chip.tsx';
import {
    type TaskPriority,
    type TaskStatus,
    taskPriorityLabels,
    taskPriorityOrder,
    taskStatusLabels,
    taskStatusOrder,
} from '../../tasks/task-presentation.ts';
import { serverTaskUpdateInput } from './server-task-control-input.ts';
import type { ServerTask } from './server-task-presentation.ts';

export function ServerTaskMetadataControls({
    labels,
    serverId,
    task,
}: {
    labels: HostedTaskLabel[];
    serverId: string;
    task: ServerTask;
}) {
    const update = useUpdateServerTask();
    const selectedLabelIds = task.labels.map((label) => label.id);

    return (
        <>
            <Select
                aria-label={`Status for task #${task.number}`}
                isDisabled={update.isPending}
                onChange={(value) => {
                    const status = value as TaskStatus;
                    if (status && status !== task.status) {
                        update.mutate(serverTaskUpdateInput(serverId, task, { status }));
                    }
                }}
                value={task.status}
                variant="secondary"
            >
                <Select.Trigger>
                    <Select.Value>{taskStatusLabels[task.status]}</Select.Value>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {taskStatusOrder.map((status) => (
                            <ListBox.Item
                                id={status}
                                key={status}
                                textValue={taskStatusLabels[status]}
                            >
                                <Label>{taskStatusLabels[status]}</Label>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            <Select
                aria-label={`Priority for task #${task.number}`}
                isDisabled={update.isPending}
                onChange={(value) => {
                    const priority = value as TaskPriority;
                    if (priority && priority !== task.priority) {
                        update.mutate(serverTaskUpdateInput(serverId, task, { priority }));
                    }
                }}
                value={task.priority}
                variant="secondary"
            >
                <Select.Trigger>
                    <Select.Value>{taskPriorityLabels[task.priority]}</Select.Value>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {taskPriorityOrder.map((priority) => (
                            <ListBox.Item
                                id={priority}
                                key={priority}
                                textValue={taskPriorityLabels[priority]}
                            >
                                <Label>{taskPriorityLabels[priority]}</Label>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            <Dropdown>
                <Button
                    aria-label={`Labels for task #${task.number}`}
                    isDisabled={update.isPending}
                    size="sm"
                    variant="secondary"
                >
                    Labels
                </Button>
                <Dropdown.Popover placement="bottom start">
                    {labels.length === 0 ? (
                        <p className="px-3 py-2 text-muted text-sm">No Server labels yet.</p>
                    ) : (
                        <Dropdown.Menu
                            onSelectionChange={(keys) =>
                                update.mutate(
                                    serverTaskUpdateInput(serverId, task, {
                                        labelIds: selectedLabelIdsFrom(keys, labels),
                                    })
                                )
                            }
                            selectedKeys={selectedLabelIds}
                            selectionMode="multiple"
                        >
                            {labels.map((label) => (
                                <Dropdown.Item id={label.id} key={label.id} textValue={label.name}>
                                    <Label>
                                        <LabelChip color={label.color} name={label.name} />
                                    </Label>
                                    <Dropdown.ItemIndicator />
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    )}
                </Dropdown.Popover>
            </Dropdown>
            {update.error ? (
                <span className="basis-full text-danger text-xs" role="alert">
                    {update.error.message}
                </span>
            ) : null}
        </>
    );
}

function selectedLabelIdsFrom(keys: 'all' | Set<Key>, labels: HostedTaskLabel[]) {
    if (keys === 'all') {
        return labels.map((label) => label.id);
    }
    return [...keys].map(String);
}
