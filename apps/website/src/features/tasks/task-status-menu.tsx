import { Button, Chip, Dropdown, Label } from '@heroui/react';
import type * as React from 'react';
import { useTaskUpdate } from '../../hooks/tasks/use-task-mutations.ts';
import {
    type TaskStatus,
    taskStatusClasses,
    taskStatusLabels,
    taskStatusOrder,
} from './task-presentation.ts';

export function TaskStatusPill({ status }: { status: TaskStatus }) {
    return (
        <Chip className={taskStatusClasses[status]} size="sm" variant="soft">
            {taskStatusLabels[status]}
        </Chip>
    );
}

export function TaskStatusMenu({
    ariaLabel,
    children,
    messageId,
    showPencil = false,
    status,
}: {
    ariaLabel: string;
    children?: React.ReactNode;
    messageId: string;
    showPencil?: boolean;
    status: TaskStatus;
}) {
    const update = useTaskUpdate();

    return (
        <Dropdown>
            <Button aria-label={ariaLabel} size="sm" variant="ghost">
                {children ?? <TaskStatusPill status={status} />}
                {showPencil ? (
                    <span aria-hidden="true" className="text-muted text-xs">
                        ✎
                    </span>
                ) : null}
            </Button>
            <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                    onSelectionChange={(keys) => {
                        const next = selectedStatus(keys);
                        if (next && next !== status) {
                            update.mutate({ messageId, patch: { status: next } });
                        }
                    }}
                    selectedKeys={[status]}
                    selectionMode="single"
                >
                    {taskStatusOrder.map((option) => (
                        <Dropdown.Item
                            id={option}
                            key={option}
                            textValue={taskStatusLabels[option]}
                        >
                            <Label>
                                <TaskStatusPill status={option} />
                            </Label>
                            <Dropdown.ItemIndicator />
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}

function selectedStatus(keys: 'all' | Set<React.Key>): TaskStatus | null {
    if (keys === 'all') {
        return null;
    }
    const [first] = [...keys];
    return typeof first === 'string' && taskStatusOrder.includes(first as TaskStatus)
        ? (first as TaskStatus)
        : null;
}
