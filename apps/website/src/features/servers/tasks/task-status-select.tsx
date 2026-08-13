import { Label, ListBox, Select } from '@heroui/react';
import {
    type TaskStatus,
    taskStatusLabels,
    taskStatusOrder,
} from '../../tasks/task-presentation.ts';

export interface TaskStatusTarget {
    id: string;
    number: number;
    status: TaskStatus;
    version: number;
}

export function TaskStatusSelect({
    error,
    isDisabled,
    onStatusChange,
    task,
}: {
    error?: { message: string } | null;
    isDisabled: boolean;
    onStatusChange: (status: TaskStatus) => void;
    task: TaskStatusTarget;
}) {
    return (
        <>
            <Select
                aria-label={`Status for task #${task.number}`}
                isDisabled={isDisabled}
                onChange={(value) => {
                    const status = value as TaskStatus;
                    if (status && status !== task.status) {
                        onStatusChange(status);
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
            {error ? (
                <span className="text-danger text-sm" role="alert">
                    {error.message}
                </span>
            ) : null}
        </>
    );
}
