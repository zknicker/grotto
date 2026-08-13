import { Button, Dropdown, Label, ListBox, Select } from '@heroui/react';
import type { Key } from 'react';
import { useTaskLabels } from '../../../hooks/servers/use-task-labels.ts';
import { useTaskUpdate } from '../../../hooks/servers/use-task-update.ts';
import { LabelChip } from '../../tasks/label-chip.tsx';
import {
    type TaskPriority,
    taskPriorityLabels,
    taskPriorityOrder,
} from '../../tasks/task-presentation.ts';
import { useServerContext } from '../server-context.ts';
import { taskUpdateInput } from './task-input.ts';
import type { TaskItem } from './task-model.ts';
import { TaskStatusSelect } from './task-status-select.tsx';

export function TaskMetadata({ task }: { task: TaskItem }) {
    const { server } = useServerContext();
    const labelsQuery = useTaskLabels(server.id);
    const labels = labelsQuery.data ?? [];
    const update = useTaskUpdate();
    const selectedLabelIds = task.labels.map((label) => label.id);

    return (
        <>
            <TaskStatusSelect
                isDisabled={update.isPending}
                onStatusChange={(status) =>
                    update.mutate(taskUpdateInput(server.id, task, { status }))
                }
                task={task}
            />
            <Select
                aria-label={`Priority for task #${task.number}`}
                isDisabled={update.isPending}
                onChange={(value) => {
                    const priority = value as TaskPriority;
                    if (priority && priority !== task.priority) {
                        update.mutate(taskUpdateInput(server.id, task, { priority }));
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
                        <p className="px-3 py-2 text-muted text-sm">No task labels yet.</p>
                    ) : (
                        <Dropdown.Menu
                            onSelectionChange={(keys) =>
                                update.mutate(
                                    taskUpdateInput(server.id, task, {
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
                <span className="basis-full text-danger text-sm" role="alert">
                    {update.error.message}
                </span>
            ) : null}
        </>
    );
}

function selectedLabelIdsFrom(keys: 'all' | Set<Key>, labels: TaskLabel[]) {
    if (keys === 'all') {
        return labels.map((label) => label.id);
    }
    return [...keys].map(String);
}

type TaskLabel = NonNullable<ReturnType<typeof useTaskLabels>['data']>[number];
