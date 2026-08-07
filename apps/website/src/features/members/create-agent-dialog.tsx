import {
    Alert,
    Button,
    Description,
    Form,
    Input,
    Label,
    ListBox,
    Modal,
    Select,
    Spinner,
    TextArea,
    TextField,
} from '@heroui/react';
import type { HostedAgent, HostedComputerInventory } from '@tavern/api';
import * as React from 'react';
import { useAgentCreate } from '../../hooks/members/use-agent-create.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { computerLabel } from '../computers/presentation.ts';
import { createAgentHandle } from './agent-handle.ts';

interface CreateAgentDialogProps {
    agents: HostedAgent[];
    onCreated: (agentId: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    serverId: string;
}

interface ReportedComputer {
    id: string;
    inventory: HostedComputerInventory;
    label: string;
}

export function CreateAgentDialog({
    agents,
    onCreated,
    onOpenChange,
    open,
    serverId,
}: CreateAgentDialogProps) {
    const computers = useComputers(serverId, { enabled: open, staleTime: 30_000 });
    const reported: ReportedComputer[] = (computers.data ?? [])
        .filter((computer) => (computer.reportedInventory?.runtimes.length ?? 0) > 0)
        .map((computer) => ({
            id: computer.id,
            inventory: computer.reportedInventory as HostedComputerInventory,
            label: computerLabel(computer),
        }));

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container scroll="outside" size="lg">
                    <Modal.Dialog>
                        <Modal.Header>
                            <div className="min-w-0 flex-1">
                                <Modal.Heading>Create Agent</Modal.Heading>
                                <p className="mt-1 text-muted text-sm">
                                    Choose where this Agent runs and what role it should take on.
                                </p>
                            </div>
                        </Modal.Header>
                        {computers.isPending ? (
                            <Modal.Body>
                                <div className="flex min-h-32 items-center justify-center">
                                    <Spinner />
                                </div>
                            </Modal.Body>
                        ) : reported.length === 0 ? (
                            <NoComputerState />
                        ) : (
                            <CreateHostedAgentForm
                                agents={agents}
                                onCreated={onCreated}
                                reported={reported}
                                serverId={serverId}
                            />
                        )}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

function CreateHostedAgentForm({
    agents,
    onCreated,
    reported,
    serverId,
}: {
    agents: HostedAgent[];
    onCreated: (agentId: string) => void;
    reported: ReportedComputer[];
    serverId: string;
}) {
    const create = useAgentCreate(serverId);
    const [computerId, setComputerId] = React.useState(reported[0]?.id ?? '');
    const computer = reported.find((entry) => entry.id === computerId) ?? reported[0];
    const runtimes = computer?.inventory.runtimes ?? [];
    const [runtimeId, setRuntimeId] = React.useState(runtimes[0]?.id ?? '');
    const runtime = runtimes.find((entry) => entry.id === runtimeId) ?? runtimes[0];
    const models = runtime?.models ?? [];
    const [modelId, setModelId] = React.useState(models[0]?.id ?? '');
    const model = models.find((entry) => entry.id === modelId) ?? models[0];
    const [displayName, setDisplayName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const name = displayName.trim();
    const canSubmit = Boolean(name && computer && runtime && model && !create.isPending);

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!(canSubmit && computer && runtime && model)) {
            return;
        }

        const result = await create.createAgent({
            computerId: computer.id,
            description: description.trim() || null,
            displayName: name,
            handle: createAgentHandle(name, agents),
            modelId: model.id,
            role: 'member',
            runtimeId: runtime.id,
            serverId,
        });
        onCreated(result.agent.id);
    });

    return (
        <Form onSubmit={handleSubmit}>
            <Modal.Body>
                <div className="grid gap-4">
                    <InventorySelect
                        label="Computer"
                        onChange={(nextId) => {
                            const next = reported.find((entry) => entry.id === nextId);
                            const firstRuntime = next?.inventory.runtimes[0];
                            setComputerId(nextId);
                            setRuntimeId(firstRuntime?.id ?? '');
                            setModelId(firstRuntime?.models[0]?.id ?? '');
                        }}
                        options={reported}
                        value={computer?.id ?? ''}
                    />
                    <TextField fullWidth onChange={setDisplayName} value={displayName}>
                        <Label>Name</Label>
                        <Input autoFocus maxLength={80} placeholder="e.g. Alice" />
                    </TextField>
                    <TextField fullWidth onChange={setDescription} value={description}>
                        <Label>Description</Label>
                        <TextArea
                            maxLength={500}
                            placeholder="Leave blank for a general-purpose Agent, or describe a role…"
                            rows={4}
                        />
                        <Description>Optional</Description>
                    </TextField>
                    <InventorySelect
                        label="Runtime"
                        onChange={(nextId) => {
                            const nextRuntime = runtimes.find((entry) => entry.id === nextId);
                            setRuntimeId(nextId);
                            setModelId(nextRuntime?.models[0]?.id ?? '');
                        }}
                        options={runtimes}
                        value={runtime?.id ?? ''}
                    />
                    <InventorySelect
                        label="Model"
                        onChange={setModelId}
                        options={models}
                        value={model?.id ?? ''}
                    />
                    {create.error ? (
                        <Alert status="danger">
                            <Alert.Content>
                                <Alert.Description>{create.error.message}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button slot="close" type="button" variant="secondary">
                    Cancel
                </Button>
                <Button isDisabled={!canSubmit} isPending={create.isPending} type="submit">
                    Create Agent
                </Button>
            </Modal.Footer>
        </Form>
    );
}

function InventorySelect({
    label,
    onChange,
    options,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    options: Array<{ id: string; label: string }>;
    value: string;
}) {
    return (
        <Select
            fullWidth
            onChange={(next) => onChange(next ? String(next) : '')}
            value={value}
            variant="secondary"
        >
            <Label>{label}</Label>
            <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {options.map((option) => (
                        <ListBox.Item id={option.id} key={option.id} textValue={option.label}>
                            <Label>{option.label}</Label>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

function NoComputerState() {
    return (
        <>
            <Modal.Body>
                <Alert status="warning">
                    <Alert.Content>
                        <Alert.Description>
                            Connect an online Computer before creating an Agent.
                        </Alert.Description>
                    </Alert.Content>
                </Alert>
            </Modal.Body>
            <Modal.Footer>
                <Button slot="close" type="button" variant="secondary">
                    Close
                </Button>
            </Modal.Footer>
        </>
    );
}
