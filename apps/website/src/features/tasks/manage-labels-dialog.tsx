import { Trash2 } from '@hugeicons/core-free-icons';
import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import { useLabelList } from '../../hooks/labels/use-label-list.ts';
import { useLabelDelete, useLabelUpdate } from '../../hooks/labels/use-label-mutations.ts';
import type { LabelRecord, TaskLabelColor } from '../../lib/trpc.tsx';
import { LabelSwatchPicker } from './label-swatch-picker.tsx';

// Full-catalog editor: rename inline, recolor via swatch, delete with a count
// warning. Reachable from the label picker and the board label filter.
export function ManageLabelsDialog({
    onOpenChange,
    open,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const labelsQuery = useLabelList();
    const labels = labelsQuery.data?.labels ?? [];
    const [pendingDelete, setPendingDelete] = React.useState<LabelRecord | null>(null);

    return (
        <>
            <Dialog onOpenChange={onOpenChange} open={open}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Manage labels</DialogTitle>
                        <DialogDescription>
                            Rename, recolor, or delete labels. Changes apply everywhere the label is
                            used.
                        </DialogDescription>
                    </DialogHeader>
                    {labels.length === 0 ? (
                        <p className="py-6 text-center text-muted-foreground text-sm">
                            No labels yet. Create one from a task's label picker.
                        </p>
                    ) : (
                        <ul className="grid max-h-[min(24rem,60dvh)] gap-1 overflow-y-auto">
                            {labels.map((label) => (
                                <LabelRow
                                    key={label.id}
                                    label={label}
                                    onDelete={() => setPendingDelete(label)}
                                />
                            ))}
                        </ul>
                    )}
                    <DialogFooter>
                        <Button onClick={() => onOpenChange(false)} variant="secondary">
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <DeleteLabelDialog
                label={pendingDelete}
                onOpenChange={(next) => {
                    if (!next) {
                        setPendingDelete(null);
                    }
                }}
            />
        </>
    );
}

function LabelRow({ label, onDelete }: { label: LabelRecord; onDelete: () => void }) {
    const updateMutation = useLabelUpdate();
    const [name, setName] = React.useState(label.name);

    React.useEffect(() => {
        setName(label.name);
    }, [label.name]);

    const patch = (change: { color?: TaskLabelColor; name?: string }) => {
        updateMutation.mutateAsync({ labelId: label.id, patch: change }).catch((error: unknown) => {
            setName(label.name);
            toastManager.add({
                description: error instanceof Error ? error.message : 'Try again.',
                title: 'Label update failed',
                type: 'error',
            });
        });
    };

    const commitName = () => {
        const trimmed = name.trim();

        if (!trimmed) {
            setName(label.name);
            return;
        }

        if (trimmed !== label.name) {
            patch({ name: trimmed });
        }
    };

    return (
        <li className="flex items-center gap-2 rounded-md px-1 py-1">
            <LabelSwatchPicker
                color={label.color}
                disabled={updateMutation.isPending}
                onChange={(color) => patch({ color })}
            />
            <Input
                aria-label={`Rename ${label.name}`}
                className="flex-1"
                disabled={updateMutation.isPending}
                onBlur={commitName}
                onChange={(event) => setName(event.currentTarget.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                }}
                size="sm"
                value={name}
            />
            <Button
                aria-label={`Delete ${label.name}`}
                onClick={onDelete}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                <Icon className="size-4" icon={Trash2} />
            </Button>
        </li>
    );
}

function DeleteLabelDialog({
    label,
    onOpenChange,
}: {
    label: LabelRecord | null;
    onOpenChange: (open: boolean) => void;
}) {
    const deleteMutation = useLabelDelete();

    const confirmDelete = () => {
        if (!label) {
            return;
        }

        deleteMutation
            .mutateAsync({ labelId: label.id })
            .then(() => onOpenChange(false))
            .catch((error: unknown) => {
                toastManager.add({
                    description: error instanceof Error ? error.message : 'Try again.',
                    title: 'Label delete failed',
                    type: 'error',
                });
            });
    };

    return (
        <Dialog onOpenChange={onOpenChange} open={label !== null}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete label?</DialogTitle>
                    <DialogDescription>
                        {label
                            ? `"${label.name}" will be removed from every task it is on. This can't be undone.`
                            : null}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} variant="secondary">
                        Cancel
                    </Button>
                    <Button
                        disabled={deleteMutation.isPending}
                        onClick={confirmDelete}
                        variant="destructive"
                    >
                        {deleteMutation.isPending ? <Spinner className="size-4" /> : null}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
