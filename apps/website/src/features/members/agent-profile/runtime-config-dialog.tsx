import type { HostedAgent, HostedComputerInventory } from '@tavern/api';
import * as React from 'react';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
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
import { Field, FieldLabel } from '../../../components/ui/primitives/field.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { isRuntimeConfigDraftAvailable, type RuntimeConfigDraft } from './runtime-config-model.ts';

type Runtime = HostedComputerInventory['runtimes'][number];

export function RuntimeConfigDialog({
    agent,
    error,
    onOpenChange,
    onSave,
    open,
    pending,
    runtimes,
}: {
    agent: HostedAgent;
    error: string | null;
    onOpenChange: (open: boolean) => void;
    onSave: (draft: RuntimeConfigDraft) => Promise<void>;
    open: boolean;
    pending: boolean;
    runtimes: Runtime[];
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent showCloseButton={false}>
                {open ? (
                    <RuntimeConfigForm
                        agent={agent}
                        error={error}
                        onCancel={() => onOpenChange(false)}
                        onSave={onSave}
                        pending={pending}
                        runtimes={runtimes}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function RuntimeConfigForm({
    agent,
    error,
    onCancel,
    onSave,
    pending,
    runtimes,
}: {
    agent: HostedAgent;
    error: string | null;
    onCancel: () => void;
    onSave: (draft: RuntimeConfigDraft) => Promise<void>;
    pending: boolean;
    runtimes: Runtime[];
}) {
    const initialRuntime =
        runtimes.find((runtime) => runtime.id === agent.desiredRuntimeId) ?? null;
    const [runtimeId, setRuntimeId] = React.useState(agent.desiredRuntimeId);
    const [modelId, setModelId] = React.useState(agent.desiredModelId);
    const selectedRuntime = runtimes.find((runtime) => runtime.id === runtimeId) ?? null;
    const draft = { modelId, runtimeId };
    const canSave = isRuntimeConfigDraftAvailable(draft, runtimes) && !pending;

    return (
        <Form
            className="contents"
            onSubmit={(event) => {
                event.preventDefault();
                if (canSave) {
                    void onSave(draft).catch(() => undefined);
                }
            }}
        >
            <DialogHeader>
                <DialogTitle>Runtime config</DialogTitle>
                <DialogDescription>
                    Choose the installed runtime and model this Agent uses.
                </DialogDescription>
            </DialogHeader>
            <DialogPanel className="grid gap-4">
                <Field>
                    <FieldLabel htmlFor="agent-runtime">Runtime</FieldLabel>
                    <Select
                        id="agent-runtime"
                        onValueChange={(value) => {
                            const runtime = runtimes.find((candidate) => candidate.id === value);
                            if (!runtime) {
                                return;
                            }
                            setRuntimeId(runtime.id);
                            setModelId(runtime.models[0]?.id ?? '');
                        }}
                        value={runtimeId}
                    >
                        <SelectTrigger aria-label="Runtime">
                            <SelectValue>
                                {selectedRuntime?.label ??
                                    `${initialRuntime?.label ?? agent.desiredRuntimeId} (not installed)`}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {initialRuntime ? null : (
                                <SelectItem disabled value={agent.desiredRuntimeId}>
                                    {agent.desiredRuntimeId} (not installed)
                                </SelectItem>
                            )}
                            {runtimes.map((runtime) => (
                                <SelectItem
                                    disabled={runtime.models.length === 0}
                                    key={runtime.id}
                                    value={runtime.id}
                                >
                                    {runtime.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field>
                    <FieldLabel htmlFor="agent-model">Model</FieldLabel>
                    <Select
                        disabled={!selectedRuntime}
                        id="agent-model"
                        onValueChange={(value) => setModelId(value ?? '')}
                        value={modelId}
                    >
                        <SelectTrigger aria-label="Model">
                            <SelectValue>
                                {selectedRuntime?.models.find((model) => model.id === modelId)
                                    ?.label ?? `${modelId} (not installed)`}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {selectedRuntime &&
                            !selectedRuntime.models.some((model) => model.id === modelId) ? (
                                <SelectItem disabled value={modelId}>
                                    {modelId} (not installed)
                                </SelectItem>
                            ) : null}
                            {selectedRuntime?.models.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                    {model.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                {error ? (
                    <Alert variant="error">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
            </DialogPanel>
            <DialogFooter variant="bare">
                <Button
                    disabled={pending}
                    onClick={onCancel}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    Cancel
                </Button>
                <Button disabled={!canSave} loading={pending} size="sm" type="submit">
                    Save
                </Button>
            </DialogFooter>
        </Form>
    );
}
