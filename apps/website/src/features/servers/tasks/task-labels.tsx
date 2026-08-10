import { Button, Form, Input, Modal, TextField } from '@heroui/react';
import type { HostedTaskLabel } from '@tavern/api';
import * as React from 'react';
import { useTaskLabelCreate } from '../../../hooks/servers/use-task-label-create.ts';
import { useTaskLabelDelete } from '../../../hooks/servers/use-task-label-delete.ts';
import { useTaskLabelUpdate } from '../../../hooks/servers/use-task-label-update.ts';
import { LabelSwatchPicker } from '../../tasks/label-swatch-picker.tsx';

export function TaskLabelsDialog({
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
    const create = useTaskLabelCreate();
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
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable>
                <Modal.Container scroll="outside" size="lg">
                    <Modal.Dialog>
                        <Modal.Header>
                            <div className="min-w-0 flex-1">
                                <Modal.Heading>Task Labels</Modal.Heading>
                                <p className="mt-1 text-muted text-sm">
                                    Labels are shared across this task board.
                                </p>
                            </div>
                        </Modal.Header>
                        <Modal.Body>
                            <div className="grid gap-4">
                                <Form className="flex items-end gap-2" onSubmit={createLabel}>
                                    <TextField
                                        aria-label="New task label"
                                        className="flex-1"
                                        onChange={setName}
                                        value={name}
                                        variant="secondary"
                                    >
                                        <Input placeholder="New label" />
                                    </TextField>
                                    <Button
                                        isDisabled={!name.trim()}
                                        isPending={create.isPending}
                                        type="submit"
                                    >
                                        Add Label
                                    </Button>
                                </Form>
                                {create.error ? (
                                    <p className="text-danger text-sm" role="alert">
                                        {create.error.message}
                                    </p>
                                ) : null}
                                {labels.length === 0 ? (
                                    <p className="py-4 text-center text-muted text-sm">
                                        No task labels yet.
                                    </p>
                                ) : (
                                    <ul className="grid max-h-72 gap-1 overflow-y-auto">
                                        {labels.map((label) => (
                                            <TaskLabelRow
                                                canManage={canManage}
                                                key={label.id}
                                                label={label}
                                                serverId={serverId}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" type="button" variant="secondary">
                                Done
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

function TaskLabelRow({
    canManage,
    label,
    serverId,
}: {
    canManage: boolean;
    label: HostedTaskLabel;
    serverId: string;
}) {
    const update = useTaskLabelUpdate();
    const remove = useTaskLabelDelete();
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
        <li className="flex flex-wrap items-center gap-2 py-1">
            <LabelSwatchPicker
                color={label.color}
                disabled={!canManage || update.isPending}
                onChange={(color) => update.mutate({ color, labelId: label.id, serverId })}
            />
            <TextField
                aria-label={`Rename ${label.name}`}
                className="flex-1"
                isDisabled={!canManage || update.isPending}
                onChange={setName}
                value={name}
                variant="secondary"
            >
                <Input
                    onBlur={commitName}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.currentTarget.blur();
                        }
                    }}
                />
            </TextField>
            {canManage ? (
                <Button
                    aria-label={`Delete ${label.name}`}
                    isPending={remove.isPending}
                    onPress={() => remove.mutate({ labelId: label.id, serverId })}
                    size="sm"
                    variant="danger-soft"
                >
                    Delete
                </Button>
            ) : null}
            {update.error || remove.error ? (
                <span className="basis-full text-danger text-xs" role="alert">
                    {(update.error ?? remove.error)?.message}
                </span>
            ) : null}
        </li>
    );
}
