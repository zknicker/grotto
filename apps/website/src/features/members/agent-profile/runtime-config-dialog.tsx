import { Alert, Button, Form, Label, ListBox, Modal, Select } from '@heroui/react';
import type { HostedAgent, HostedComputerInventory } from '@tavern/api';
import * as React from 'react';
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
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <RuntimeConfigForm
                            agent={agent}
                            error={error}
                            onSave={onSave}
                            pending={pending}
                            runtimes={runtimes}
                        />
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

function RuntimeConfigForm({
    agent,
    error,
    onSave,
    pending,
    runtimes,
}: {
    agent: HostedAgent;
    error: string | null;
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
    const models = selectedRuntime?.models ?? [];
    const modelIsInstalled = models.some((model) => model.id === modelId);
    const disabledRuntimeKeys = runtimes
        .filter((runtime) => runtime.models.length === 0)
        .map((runtime) => runtime.id);
    if (!initialRuntime) {
        disabledRuntimeKeys.push(agent.desiredRuntimeId);
    }

    return (
        <Form
            onSubmit={(event) => {
                event.preventDefault();
                if (canSave) {
                    void onSave(draft).catch(() => undefined);
                }
            }}
        >
            <Modal.Header>
                <div className="min-w-0 flex-1">
                    <Modal.Heading>Runtime Config</Modal.Heading>
                    <p className="mt-1 text-muted text-sm">
                        Choose the installed runtime and model this Agent uses.
                    </p>
                </div>
            </Modal.Header>
            <Modal.Body>
                <div className="grid gap-4">
                    <Select
                        disabledKeys={disabledRuntimeKeys}
                        fullWidth
                        onChange={(value) => {
                            const runtime = runtimes.find(
                                (candidate) => candidate.id === String(value)
                            );
                            if (!runtime) {
                                return;
                            }
                            setRuntimeId(runtime.id);
                            setModelId(runtime.models[0]?.id ?? '');
                        }}
                        value={runtimeId}
                        variant="secondary"
                    >
                        <Label>Runtime</Label>
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {initialRuntime ? null : (
                                    <ListBox.Item
                                        id={agent.desiredRuntimeId}
                                        textValue={`${agent.desiredRuntimeId} (not installed)`}
                                    >
                                        <Label>{agent.desiredRuntimeId} (not installed)</Label>
                                    </ListBox.Item>
                                )}
                                {runtimes.map((runtime) => (
                                    <ListBox.Item
                                        id={runtime.id}
                                        key={runtime.id}
                                        textValue={runtime.label}
                                    >
                                        <Label>{runtime.label}</Label>
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                    <Select
                        disabledKeys={modelIsInstalled ? [] : [modelId]}
                        fullWidth
                        isDisabled={!selectedRuntime}
                        onChange={(value) => setModelId(value ? String(value) : '')}
                        value={modelId}
                        variant="secondary"
                    >
                        <Label>Model</Label>
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {modelIsInstalled ? null : (
                                    <ListBox.Item
                                        id={modelId}
                                        textValue={`${modelId} (not installed)`}
                                    >
                                        <Label>{modelId} (not installed)</Label>
                                    </ListBox.Item>
                                )}
                                {models.map((model) => (
                                    <ListBox.Item
                                        id={model.id}
                                        key={model.id}
                                        textValue={model.label}
                                    >
                                        <Label>{model.label}</Label>
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                    {error ? (
                        <Alert status="danger">
                            <Alert.Content>
                                <Alert.Description>{error}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button isDisabled={pending} slot="close" type="button" variant="secondary">
                    Cancel
                </Button>
                <Button isDisabled={!canSave} isPending={pending} type="submit">
                    Save
                </Button>
            </Modal.Footer>
        </Form>
    );
}
