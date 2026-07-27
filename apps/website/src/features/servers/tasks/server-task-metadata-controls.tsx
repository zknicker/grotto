import type { HostedTaskLabel } from '@tavern/api';
import { Menu, MenuCheckboxItem, MenuPopup, MenuTrigger } from '../../../components/ui/menu.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { useUpdateServerTask } from '../../../hooks/servers/use-update-server-task.ts';
import { LabelChip } from '../../tasks/label-chip.tsx';
import {
    taskPriorityLabels,
    taskPriorityOrder,
    taskStatusLabels,
    taskStatusOrder,
} from '../../tasks/task-presentation.ts';
import { serverTaskUpdateInput, toggledServerTaskLabelIds } from './server-task-control-input.ts';
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
                disabled={update.isPending}
                onValueChange={(status) => {
                    if (status && status !== task.status) {
                        update.mutate(serverTaskUpdateInput(serverId, task, { status }));
                    }
                }}
                value={task.status}
            >
                <SelectTrigger aria-label={`Status for task #${task.number}`} size="sm">
                    <SelectValue>{taskStatusLabels[task.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {taskStatusOrder.map((status) => (
                        <SelectItem key={status} value={status}>
                            {taskStatusLabels[status]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                disabled={update.isPending}
                onValueChange={(priority) => {
                    if (priority && priority !== task.priority) {
                        update.mutate(serverTaskUpdateInput(serverId, task, { priority }));
                    }
                }}
                value={task.priority}
            >
                <SelectTrigger aria-label={`Priority for task #${task.number}`} size="sm">
                    <SelectValue>{taskPriorityLabels[task.priority]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {taskPriorityOrder.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                            {taskPriorityLabels[priority]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Menu>
                <MenuTrigger
                    render={
                        <Button
                            aria-label={`Labels for task #${task.number}`}
                            disabled={update.isPending}
                            size="xs"
                            variant="secondary"
                        />
                    }
                >
                    Labels
                </MenuTrigger>
                <MenuPopup align="start" className="min-w-44">
                    {labels.length === 0 ? (
                        <p className="px-2 py-1 text-muted-foreground text-sm">
                            No Server labels yet.
                        </p>
                    ) : (
                        labels.map((label) => (
                            <MenuCheckboxItem
                                checked={selectedLabelIds.includes(label.id)}
                                closeOnClick={false}
                                disabled={update.isPending}
                                key={label.id}
                                onCheckedChange={(selected) =>
                                    update.mutate(
                                        serverTaskUpdateInput(serverId, task, {
                                            labelIds: toggledServerTaskLabelIds(
                                                selectedLabelIds,
                                                label.id,
                                                selected
                                            ),
                                        })
                                    )
                                }
                            >
                                <LabelChip color={label.color} name={label.name} />
                            </MenuCheckboxItem>
                        ))
                    )}
                </MenuPopup>
            </Menu>
            {update.error ? (
                <span className="basis-full text-destructive text-xs" role="alert">
                    {update.error.message}
                </span>
            ) : null}
        </>
    );
}
