import type { HostedTaskLabel } from '@tavern/api';
import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { useCreateServerTaskLabel } from '../../../hooks/servers/use-create-server-task-label.ts';
import { useDeleteServerTaskLabel } from '../../../hooks/servers/use-delete-server-task-label.ts';
import { useUpdateServerTaskLabel } from '../../../hooks/servers/use-update-server-task-label.ts';
import { LabelSwatchPicker } from '../../tasks/label-swatch-picker.tsx';

export function ServerTaskLabelsDialog({
    canManage,
    labels,
    onOpenChange,
    open,
    serverId,
}: {
    canManage: boolean;
    labels: HostedTaskLabel[];
    onOpenChange: (open: boolean) => void;
    open: boolean;
    serverId: string;
}) {
    const create = useCreateServerTaskLabel();
    const [name, setName] = React.useState('');

    async function createLabel(event: React.FormEvent) {
        event.preventDefault();
        const nextName = name.trim();
        if (!nextName) {
            return;
        }
        await create.mutateAsync({ name: nextName, serverId });
        setName('');
    }

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>Task labels</DialogTitle>
                    <DialogDescription>
                        Server labels stay task-specific and are shared across this task board.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="grid gap-4">
                    <form className="flex gap-2" onSubmit={createLabel}>
                        <Input
                            aria-label="New task label"
                            onChange={(event) => setName(event.target.value)}
                            placeholder="New label"
                            size="sm"
                            value={name}
                        />
                        <Button
                            disabled={!name.trim()}
                            loading={create.isPending}
                            size="sm"
                            type="submit"
                        >
                            Add label
                        </Button>
                    </form>
                    {create.error ? (
                        <p className="text-destructive text-sm" role="alert">
                            {create.error.message}
                        </p>
                    ) : null}
                    {labels.length === 0 ? (
                        <p className="py-4 text-center text-muted-foreground text-sm">
                            No task labels yet.
                        </p>
                    ) : (
                        <ul className="grid max-h-72 gap-1 overflow-y-auto">
                            {labels.map((label) => (
                                <ServerTaskLabelRow
                                    canManage={canManage}
                                    key={label.id}
                                    label={label}
                                    serverId={serverId}
                                />
                            ))}
                        </ul>
                    )}
                </DialogPanel>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} size="sm" variant="secondary">
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ServerTaskLabelRow({
    canManage,
    label,
    serverId,
}: {
    canManage: boolean;
    label: HostedTaskLabel;
    serverId: string;
}) {
    const update = useUpdateServerTaskLabel();
    const remove = useDeleteServerTaskLabel();
    const [name, setName] = React.useState(label.name);

    React.useEffect(() => setName(label.name), [label.name]);

    const commitName = () => {
        const nextName = name.trim();
        if (!nextName) {
            setName(label.name);
        } else if (nextName !== label.name) {
            update.mutate({ labelId: label.id, name: nextName, serverId });
        }
    };

    return (
        <li className="flex items-center gap-2 rounded-lg px-1 py-1">
            <LabelSwatchPicker
                color={label.color}
                disabled={!canManage || update.isPending}
                onChange={(color) => update.mutate({ color, labelId: label.id, serverId })}
            />
            <Input
                aria-label={`Rename ${label.name}`}
                disabled={!canManage || update.isPending}
                onBlur={commitName}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                }}
                size="sm"
                value={name}
            />
            {canManage ? (
                <Button
                    aria-label={`Delete ${label.name}`}
                    loading={remove.isPending}
                    onClick={() => remove.mutate({ labelId: label.id, serverId })}
                    size="xs"
                    variant="destructive-ghost"
                >
                    Delete
                </Button>
            ) : null}
            {update.error || remove.error ? (
                <span className="basis-full text-destructive text-xs" role="alert">
                    {(update.error ?? remove.error)?.message}
                </span>
            ) : null}
        </li>
    );
}
