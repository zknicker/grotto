import { Label, ListBox, Select } from '@heroui/react';
import { InlineSelect } from '@heroui-pro/react/inline-select';
import {
    type TaskStatus,
    taskStatusLabels,
    taskStatusOrder,
} from '../../tasks/task-presentation.ts';
import { TaskStatusDisc } from '../../tasks/task-status-disc.tsx';

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
    presentation = 'boxed',
    task,
}: {
    error?: { message: string } | null;
    isDisabled: boolean;
    onStatusChange: (status: TaskStatus) => void;
    /** `inline` drops the field box so the value reads as text. */
    presentation?: 'boxed' | 'inline';
    task: TaskStatusTarget;
}) {
    const onChange = (value: unknown) => {
        const status = value as TaskStatus;
        if (status && status !== task.status) {
            onStatusChange(status);
        }
    };

    if (presentation === 'inline') {
        return (
            <>
                <InlineSelect
                    aria-label={`Status for task #${task.number}`}
                    isDisabled={isDisabled}
                    onChange={onChange}
                    value={task.status}
                >
                    <InlineSelect.Trigger className="gap-1.5">
                        <TaskStatusDisc className="size-3.5" status={task.status} />
                        <span className="truncate text-sm">{taskStatusLabels[task.status]}</span>
                        <InlineSelect.Indicator />
                    </InlineSelect.Trigger>
                    <InlineSelect.Popover className="w-44">
                        <ListBox>
                            {taskStatusOrder.map((status) => (
                                <ListBox.Item
                                    id={status}
                                    key={status}
                                    textValue={taskStatusLabels[status]}
                                >
                                    <TaskStatusDisc className="size-[14px]" status={status} />
                                    <Label>{taskStatusLabels[status]}</Label>
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </InlineSelect.Popover>
                </InlineSelect>
                {error ? (
                    <span className="text-danger text-sm" role="alert">
                        {error.message}
                    </span>
                ) : null}
            </>
        );
    }

    return (
        <>
            <Select
                aria-label={`Status for task #${task.number}`}
                fullWidth
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
