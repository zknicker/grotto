import { Task01Icon } from '@hugeicons-pro/core-solid-rounded';
import type { MessageTask } from '@tavern/api';
import { Chip } from 'heroui-native/chip';
import { AppIcon } from './app-icon.tsx';

const taskStatusLabels: Record<MessageTask['status'], string> = {
    closed: 'Closed',
    done: 'Done',
    in_progress: 'In progress',
    in_review: 'In review',
    todo: 'Todo',
};

export function MessageTaskChip({ task }: { task: MessageTask }) {
    const label = `Task #${task.number} · ${taskStatusLabels[task.status]}`;

    return (
        <Chip accessibilityLabel={label} color="default" size="sm" variant="secondary">
            <AppIcon icon={Task01Icon} size={14} tone="muted" />
            <Chip.Label>{label}</Chip.Label>
        </Chip>
    );
}
