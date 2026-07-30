import type { HostedAgent, HostedComputerInventory } from '@tavern/api';
import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { computerLabel } from '../computers/presentation.ts';
import { createHostedAgentHandle } from './create-hosted-agent-handle.ts';

interface CreateHostedAgentDialogProps {
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

const coveDescription = 'Onboarding guide — helps you shape your team and start real work';

export function CreateHostedAgentDialog({
    agents,
    onCreated,
    onOpenChange,
    open,
    serverId,
}: CreateHostedAgentDialogProps) {
    const computers = grottoTrpc.computer.list.useQuery(
        { serverId },
        { enabled: open, staleTime: 30_000 }
    );
    const reported: ReportedComputer[] = (computers.data ?? [])
        .filter((computer) => (computer.reportedInventory?.runtimes.length ?? 0) > 0)
        .map((computer) => ({
            id: computer.id,
            inventory: computer.reportedInventory as HostedComputerInventory,
            label: computerLabel(computer),
        }));

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent showCloseButton={false} size="lg">
                <DialogHeader>
                    <DialogTitle>Create Agent</DialogTitle>
                    <DialogDescription>
                        Choose where this Agent runs and what role it should take on.
                    </DialogDescription>
                </DialogHeader>
                {open ? (
                    computers.isPending ? (
                        <div className="flex min-h-32 items-center justify-center">
                            <Spinner className="size-4" />
                        </div>
                    ) : reported.length === 0 ? (
                        <NoComputerState onClose={() => onOpenChange(false)} />
                    ) : (
                        <CreateHostedAgentForm
                            agents={agents}
                            firstAgent={agents.length === 0}
                            onClose={() => onOpenChange(false)}
                            onCreated={onCreated}
                            reported={reported}
                            serverId={serverId}
                        />
                    )
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function CreateHostedAgentForm({
    agents,
    firstAgent,
    onClose,
    onCreated,
    reported,
    serverId,
}: {
    agents: HostedAgent[];
    firstAgent: boolean;
    onClose: () => void;
    onCreated: (agentId: string) => void;
    reported: ReportedComputer[];
    serverId: string;
}) {
    const utils = grottoTrpc.useUtils();
    const create = grottoTrpc.agent.create.useMutation();
    const [computerId, setComputerId] = React.useState(reported[0]?.id ?? '');
    const computer = reported.find((entry) => entry.id === computerId) ?? reported[0];
    const runtimes = computer?.inventory.runtimes ?? [];
    const [runtimeId, setRuntimeId] = React.useState(runtimes[0]?.id ?? '');
    const runtime = runtimes.find((entry) => entry.id === runtimeId) ?? runtimes[0];
    const models = runtime?.models ?? [];
    const [modelId, setModelId] = React.useState(models[0]?.id ?? '');
    const model = models.find((entry) => entry.id === modelId) ?? models[0];
    const [displayName, setDisplayName] = React.useState(firstAgent ? 'Cove' : '');
    const [description, setDescription] = React.useState(firstAgent ? coveDescription : '');
    const name = displayName.trim();
    const isCove = firstAgent && name.toLowerCase() === 'cove';
    const canSubmit = Boolean(name && computer && runtime && model && !create.isPending);

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!(canSubmit && computer && runtime && model)) {
            return;
        }

        const result = await create.mutateAsync({
            archetype: isCove ? 'guide' : undefined,
            computerId: computer.id,
            description: description.trim() || null,
            displayName: name,
            handle: createHostedAgentHandle(name, agents),
            modelId: model.id,
            role: 'member',
            runtimeId: runtime.id,
            serverId,
        });
        await Promise.all([
            utils.agent.list.invalidate({ serverId }),
            utils.chat.list.invalidate({ serverId }),
        ]);
        onCreated(result.agent.id);
    });

    return (
        <Form className="contents" onSubmit={handleSubmit}>
            <DialogPanel className="grid gap-4">
                <Field>
                    <FieldLabel>Computer</FieldLabel>
                    <Select
                        onValueChange={(value) => {
                            const nextId = value ?? '';
                            const next = reported.find((entry) => entry.id === nextId);
                            const firstRuntime = next?.inventory.runtimes[0];
                            setComputerId(nextId);
                            setRuntimeId(firstRuntime?.id ?? '');
                            setModelId(firstRuntime?.models[0]?.id ?? '');
                        }}
                        value={computer?.id ?? ''}
                    >
                        <SelectTrigger aria-label="Computer">
                            <SelectValue>{computer?.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {reported.map((entry) => (
                                <SelectItem key={entry.id} value={entry.id}>
                                    {entry.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field>
                    <FieldLabel htmlFor="create-agent-name">Name</FieldLabel>
                    <Input
                        autoFocus
                        id="create-agent-name"
                        maxLength={80}
                        onChange={(event) => {
                            const nextName = event.currentTarget.value;
                            if (
                                firstAgent &&
                                displayName === 'Cove' &&
                                description === coveDescription &&
                                nextName.trim().toLowerCase() !== 'cove'
                            ) {
                                setDescription('');
                            }
                            setDisplayName(nextName);
                        }}
                        placeholder="e.g. Alice"
                        type="text"
                        value={displayName}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="create-agent-description">
                        Description <span className="text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Textarea
                        id="create-agent-description"
                        maxLength={500}
                        onChange={(event) => setDescription(event.currentTarget.value)}
                        placeholder="Leave blank for a general-purpose Agent, or describe a role…"
                        rows={4}
                        value={description}
                    />
                </Field>
                <Field>
                    <FieldLabel>Runtime</FieldLabel>
                    <Select
                        onValueChange={(value) => {
                            const nextId = value ?? '';
                            const nextRuntime = runtimes.find((entry) => entry.id === nextId);
                            setRuntimeId(nextId);
                            setModelId(nextRuntime?.models[0]?.id ?? '');
                        }}
                        value={runtime?.id ?? ''}
                    >
                        <SelectTrigger aria-label="Runtime">
                            <SelectValue>{runtime?.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {runtimes.map((entry) => (
                                <SelectItem key={entry.id} value={entry.id}>
                                    {entry.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field>
                    <FieldLabel>Model</FieldLabel>
                    <Select
                        onValueChange={(value) => setModelId(value ?? '')}
                        value={model?.id ?? ''}
                    >
                        <SelectTrigger aria-label="Model">
                            <SelectValue>{model?.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {models.map((entry) => (
                                <SelectItem key={entry.id} value={entry.id}>
                                    {entry.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                {create.error ? (
                    <Alert variant="error">
                        <AlertDescription>{create.error.message}</AlertDescription>
                    </Alert>
                ) : null}
            </DialogPanel>
            <DialogFooter variant="bare">
                <Button onClick={onClose} size="sm" type="button" variant="ghost">
                    Cancel
                </Button>
                <Button disabled={!canSubmit} loading={create.isPending} size="sm" type="submit">
                    Create Agent
                </Button>
            </DialogFooter>
        </Form>
    );
}

function NoComputerState({ onClose }: { onClose: () => void }) {
    return (
        <>
            <DialogPanel>
                <Alert>
                    <AlertDescription>
                        Connect an online Computer before creating an Agent.
                    </AlertDescription>
                </Alert>
            </DialogPanel>
            <DialogFooter variant="bare">
                <Button onClick={onClose} size="sm" type="button" variant="ghost">
                    Close
                </Button>
            </DialogFooter>
        </>
    );
}
