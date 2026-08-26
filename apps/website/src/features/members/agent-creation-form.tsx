import type { Agent, AgentReasoningEffort } from '@grotto/api';
import {
    Alert,
    Button,
    Description,
    Form,
    Input,
    Label,
    Modal,
    TextArea,
    TextField,
} from '@heroui/react';
import * as React from 'react';
import { AvatarPicker } from '../avatars/avatar-picker.tsx';
import type { AvatarImage } from '../avatars/resize-avatar-image.ts';
import type {
    AgentCreationInitialValues,
    AgentCreationSubmitValues,
    ReportedComputer,
} from './agent-creation-contract.ts';
import { resolveAgentCreationDefaults } from './agent-creation-defaults.ts';
import { createAgentHandle } from './agent-handle.ts';
import { InventorySelect } from './inventory-select.tsx';

export type {
    AgentCreationInitialValues,
    AgentCreationSubmitValues,
    ReportedComputer,
} from './agent-creation-contract.ts';

interface AgentCreationFormProps {
    agents: readonly Agent[];
    error: { message: string } | null;
    initialValues?: AgentCreationInitialValues;
    isPending: boolean;
    onCreated: (agentId: string) => void;
    onSubmit: (values: AgentCreationSubmitValues) => Promise<{ agentId: string }>;
    reported: ReportedComputer[];
}

export function AgentCreationForm({
    agents,
    error,
    initialValues,
    isPending,
    onCreated,
    onSubmit,
    reported,
}: AgentCreationFormProps) {
    const defaults = React.useMemo(
        () => resolveAgentCreationDefaults(reported, agents, initialValues),
        [agents, initialValues, reported]
    );
    const defaultsKey = JSON.stringify(defaults);
    const initializedKey = React.useRef<string | null>(null);
    const [computerId, setComputerId] = React.useState(defaults.computerId);
    const [runtimeId, setRuntimeId] = React.useState(defaults.runtimeId);
    const [modelId, setModelId] = React.useState(defaults.modelId);
    const [reasoningEffort, setReasoningEffort] = React.useState<AgentReasoningEffort>(
        defaults.reasoningEffort
    );
    const [displayName, setDisplayName] = React.useState(initialValues?.displayName ?? '');
    const [description, setDescription] = React.useState(initialValues?.description ?? '');
    const [avatar, setAvatar] = React.useState<AvatarImage | null>(null);
    const [avatarError, setAvatarError] = React.useState<string | null>(null);
    const formId = React.useId();

    React.useEffect(() => {
        if (initializedKey.current === defaultsKey) {
            return;
        }
        initializedKey.current = defaultsKey;
        setComputerId(defaults.computerId);
        setRuntimeId(defaults.runtimeId);
        setModelId(defaults.modelId);
        setReasoningEffort(defaults.reasoningEffort);
        setDisplayName(initialValues?.displayName ?? '');
        setDescription(initialValues?.description ?? '');
        setAvatar(null);
        setAvatarError(null);
    }, [defaults, defaultsKey, initialValues]);

    const computer = reported.find((entry) => entry.id === computerId) ?? reported[0];
    const runtimes = computer?.inventory.runtimes ?? [];
    const runtime = runtimes.find((entry) => entry.id === runtimeId) ?? runtimes[0];
    const models = runtime?.models ?? [];
    const model = models.find((entry) => entry.id === modelId) ?? models[0];
    const name = displayName.trim();
    const canSubmit = Boolean(name && computer && runtime && model && !isPending && !avatarError);
    const avatarSrc = avatar?.dataUrl ?? initialValues?.avatarUrl ?? null;

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!(canSubmit && computer && runtime && model)) {
            return;
        }

        try {
            const result = await onSubmit({
                ...(avatar
                    ? {
                          avatar: {
                              bytesBase64: avatar.base64,
                              mediaType: avatar.mediaType,
                          },
                      }
                    : {}),
                computerId: computer.id,
                description: description.trim() || null,
                displayName: name,
                handle: createAgentHandle(name, agents),
                modelId: model.id,
                reasoningEffort,
                runtimeId: runtime.id,
            });
            onCreated(result.agentId);
        } catch {
            // The mutation owns the visible error. Keeping the form mounted is
            // what makes a stale-action or validation refusal recoverable.
        }
    });

    return (
        <>
            <Modal.Body>
                <Form className="grid gap-4" id={formId} onSubmit={handleSubmit}>
                    <div className="flex items-center gap-3">
                        <AvatarPicker
                            label="avatar"
                            name={name || 'New Agent'}
                            onError={setAvatarError}
                            onSelect={setAvatar}
                            size={72}
                            src={avatarSrc}
                        />
                        <div className="min-w-0">
                            <p className="font-medium text-sm">Agent avatar</p>
                            <p className="text-muted text-sm">
                                {avatar
                                    ? 'New image selected.'
                                    : 'The prepared image stays unchanged unless you replace it.'}
                            </p>
                        </div>
                    </div>
                    <InventorySelect
                        description={
                            reported.length === 0
                                ? 'Connect a Computer before you can create this Agent.'
                                : undefined
                        }
                        disabled={reported.length === 0}
                        label="Computer"
                        onChange={(nextId) => {
                            const next = reported.find((entry) => entry.id === nextId);
                            const firstRuntime = next?.inventory.runtimes[0];
                            setComputerId(nextId);
                            setRuntimeId(firstRuntime?.id ?? '');
                            setModelId(firstRuntime?.models[0]?.id ?? '');
                        }}
                        options={reported}
                        placeholder={
                            reported.length === 0 ? 'No Computers available' : 'Select a Computer'
                        }
                        value={computer?.id ?? ''}
                    />
                    <TextField
                        fullWidth
                        onChange={setDisplayName}
                        value={displayName}
                        variant="secondary"
                    >
                        <Label>Name</Label>
                        <Input autoFocus maxLength={80} placeholder="e.g. Alice" />
                    </TextField>
                    <TextField
                        fullWidth
                        onChange={setDescription}
                        value={description}
                        variant="secondary"
                    >
                        <Label>Description</Label>
                        <TextArea
                            maxLength={500}
                            placeholder="Leave blank for a general-purpose Agent, or describe a role…"
                            rows={4}
                        />
                        <Description>Optional</Description>
                    </TextField>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <InventorySelect
                            disabled={!computer}
                            label="Runtime"
                            onChange={(nextId) => {
                                const nextRuntime = runtimes.find((entry) => entry.id === nextId);
                                setRuntimeId(nextId);
                                setModelId(nextRuntime?.models[0]?.id ?? '');
                            }}
                            options={runtimes}
                            placeholder="Select a runtime"
                            value={runtime?.id ?? ''}
                        />
                        <InventorySelect
                            disabled={!runtime}
                            label="Model"
                            onChange={setModelId}
                            options={models}
                            placeholder="Select a model"
                            value={model?.id ?? ''}
                        />
                    </div>
                    <InventorySelect
                        label="Reasoning effort"
                        onChange={(value) => {
                            if (isReasoningEffort(value)) {
                                setReasoningEffort(value);
                            }
                        }}
                        options={reasoningOptions}
                        placeholder="Select reasoning effort"
                        value={reasoningEffort}
                    />
                    {avatarError || error ? (
                        <Alert status="danger">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Description>
                                    {avatarError ?? error?.message}
                                </Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null}
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button slot="close" type="button" variant="secondary">
                    Cancel
                </Button>
                <Button form={formId} isDisabled={!canSubmit} isPending={isPending} type="submit">
                    Create Agent
                </Button>
            </Modal.Footer>
        </>
    );
}

const reasoningOptions = [
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
] as const;

function isReasoningEffort(value: string): value is AgentReasoningEffort {
    return value === 'low' || value === 'medium' || value === 'high';
}
