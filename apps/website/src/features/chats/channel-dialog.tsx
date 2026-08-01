import {
    Alert,
    Button,
    Checkbox,
    CheckboxGroup,
    Description,
    FieldError,
    Form,
    Input,
    Label,
    Modal,
    Spinner,
    TextField,
} from '@heroui/react';
import { AlertCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { AgentOptionLabel } from '../agents/agent-option-label.tsx';
import type { AgentFace } from './agent-face.tsx';

export interface ChannelAgentOption {
    effectiveCharacter: React.ComponentProps<typeof AgentFace>['head'];
    effectivePrimaryColor: string | null;
    id: string;
    name: string;
}

interface ChannelDialogProps {
    agents: ChannelAgentOption[];
    agentsPending: boolean;
    errorMessage: string | null;
    initialAgentIds: string[];
    initialDisplayName: string;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (input: { agentIds: string[]; displayName: string }) => Promise<void>;
    open: boolean;
    showDisplayName?: boolean;
    submitLabel: string;
    title: string;
}

export function ChannelDialog({
    agents,
    agentsPending,
    errorMessage,
    initialAgentIds,
    initialDisplayName,
    isPending,
    onClose,
    onSubmit,
    open,
    showDisplayName = true,
    submitLabel,
    title,
}: ChannelDialogProps) {
    return (
        <Modal isOpen={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <Modal.Backdrop>
                <Modal.Container scroll="outside" size="lg">
                    <Modal.Dialog>
                        {open ? (
                            <ChannelDialogForm
                                agents={agents}
                                agentsPending={agentsPending}
                                errorMessage={errorMessage}
                                initialAgentIds={initialAgentIds}
                                initialDisplayName={initialDisplayName}
                                isPending={isPending}
                                key={`${title}:${initialDisplayName}:${initialAgentIds.join(',')}`}
                                onClose={onClose}
                                onSubmit={onSubmit}
                                showDisplayName={showDisplayName}
                                submitLabel={submitLabel}
                                title={title}
                            />
                        ) : null}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

interface ChannelDialogFormProps extends Omit<ChannelDialogProps, 'open'> {
    onClose: () => void;
}

function ChannelDialogForm({
    agents,
    agentsPending,
    errorMessage,
    initialAgentIds,
    initialDisplayName,
    isPending,
    onClose,
    onSubmit,
    showDisplayName = true,
    submitLabel,
    title,
}: ChannelDialogFormProps) {
    const [displayName, setDisplayName] = React.useState(initialDisplayName);
    const [selectedAgentIds, setSelectedAgentIds] = React.useState(() =>
        normalizeChannelAgentIds(initialAgentIds)
    );
    const trimmedDisplayName = displayName.trim();
    const agentIds = normalizeChannelAgentIds(selectedAgentIds);
    // The channel name IS its handle (specs/grotto-cli.md §2): one token,
    // 1-32 chars, no spaces. Renames change the handle, so both create and
    // rename enforce the same rule the runtime does.
    const handleIssue =
        showDisplayName &&
        trimmedDisplayName.length > 0 &&
        !isValidChannelHandle(trimmedDisplayName)
            ? 'Channel names are single handles: letters, numbers, dashes, or underscores — no spaces, up to 32 characters.'
            : null;
    const canSubmit =
        (showDisplayName
            ? trimmedDisplayName.length > 0 && !handleIssue
            : initialDisplayName.trim().length > 0) &&
        agentIds.length > 0 &&
        !isPending;

    React.useEffect(() => {
        if (selectedAgentIds.length > 0 || agents.length === 0 || initialAgentIds.length > 0) {
            return;
        }

        setSelectedAgentIds([agents[0]?.id ?? ''].filter(Boolean));
    }, [agents, initialAgentIds.length, selectedAgentIds.length]);

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        await onSubmit({
            agentIds,
            displayName: showDisplayName ? trimmedDisplayName : initialDisplayName.trim(),
        });
    });

    return (
        <Form onSubmit={handleSubmit}>
            <Modal.Header>
                <div className="min-w-0 flex-1">
                    <Modal.Heading>{title}</Modal.Heading>
                    <p className="mt-1 text-muted text-sm">
                        {showDisplayName
                            ? 'Name the channel and choose its agents.'
                            : 'Choose the agents in this channel.'}
                    </p>
                </div>
            </Modal.Header>
            <Modal.Body>
                <div className="grid gap-4">
                    {showDisplayName ? (
                        <TextField
                            fullWidth
                            isInvalid={Boolean(handleIssue)}
                            onChange={setDisplayName}
                            value={displayName}
                            variant="secondary"
                        >
                            <Label>Channel name</Label>
                            <Input autoFocus placeholder="planning" type="text" />
                            {handleIssue ? <FieldError>{handleIssue}</FieldError> : null}
                        </TextField>
                    ) : null}
                    <AgentCheckboxGroup
                        agents={agents}
                        agentsPending={agentsPending}
                        disabled={isPending}
                        onSelectedAgentIdsChange={setSelectedAgentIds}
                        selectedAgentIds={selectedAgentIds}
                    />
                    {errorMessage ? (
                        <Alert status="danger">
                            <Alert.Indicator>
                                <Icon icon={AlertCircleIcon} />
                            </Alert.Indicator>
                            <Alert.Content>
                                <Alert.Description>{errorMessage}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button onPress={onClose} type="button" variant="secondary">
                    Cancel
                </Button>
                <Button isDisabled={!canSubmit} isPending={isPending} type="submit">
                    {submitLabel}
                </Button>
            </Modal.Footer>
        </Form>
    );
}

function AgentCheckboxGroup({
    agents,
    agentsPending,
    disabled,
    onSelectedAgentIdsChange,
    selectedAgentIds,
}: {
    agents: ChannelAgentOption[];
    agentsPending: boolean;
    disabled: boolean;
    onSelectedAgentIdsChange: (agentIds: string[]) => void;
    selectedAgentIds: string[];
}) {
    return (
        <CheckboxGroup
            isDisabled={disabled}
            // A channel always keeps at least one agent, so an empty selection
            // is dropped instead of applied.
            onChange={(nextAgentIds) =>
                nextAgentIds.length > 0 &&
                onSelectedAgentIdsChange(normalizeChannelAgentIds(nextAgentIds))
            }
            value={selectedAgentIds}
        >
            <Label>Agents</Label>
            {agents.length > 0 ? (
                <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-separator p-1.5">
                    {agents.map((agent) => (
                        <Checkbox key={agent.id} value={agent.id} variant="secondary">
                            <Checkbox.Content>
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <AgentOptionLabel
                                    agent={{
                                        character: agent.effectiveCharacter ?? 'none',
                                        id: agent.id,
                                        name: agent.name,
                                        primaryColor: agent.effectivePrimaryColor,
                                    }}
                                />
                            </Checkbox.Content>
                        </Checkbox>
                    ))}
                </div>
            ) : null}
            {agentsPending ? (
                <div className="flex items-center gap-2 text-muted text-sm">
                    <Spinner color="current" size="sm" />
                    Loading agents
                </div>
            ) : null}
            {!agentsPending && agents.length === 0 ? (
                <Description>No agents available.</Description>
            ) : null}
        </CheckboxGroup>
    );
}

export function normalizeChannelAgentIds(agentIds: string[]) {
    return [...new Set(agentIds.map((agentId) => agentId.trim()).filter(Boolean))];
}

function isValidChannelHandle(value: string) {
    return /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u.test(value);
}
