import {
    Alert,
    Button,
    Description,
    FieldError,
    Form,
    Input,
    Label,
    Modal,
    SearchField,
    Spinner,
    TextField,
} from '@heroui/react';
import { CheckboxButtonGroup } from '@heroui-pro/react';
import { AlertCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';

export interface ChannelAgentOption {
    avatarUrl: string | null;
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

    // Seed a default agent once in create mode; after that the selection is
    // the user's, including an empty one (Save just disables).
    const seededDefaultAgent = React.useRef(initialAgentIds.length > 0);
    React.useEffect(() => {
        if (seededDefaultAgent.current || agents.length === 0) {
            return;
        }

        seededDefaultAgent.current = true;
        setSelectedAgentIds([agents[0]?.id ?? ''].filter(Boolean));
    }, [agents]);

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
                <div className="flex flex-col gap-5">
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
                    <AgentButtonGroup
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

function AgentButtonGroup({
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
    const [query, setQuery] = React.useState('');
    const trimmedQuery = query.trim().toLowerCase();
    const visibleAgents = trimmedQuery
        ? agents.filter((agent) => agent.name.toLowerCase().includes(trimmedQuery))
        : agents;

    return (
        <div className="flex flex-col gap-2">
            <Label>Agents</Label>
            {agents.length > searchableAgentCount ? (
                <SearchField
                    aria-label="Filter agents"
                    onChange={setQuery}
                    value={query}
                    variant="secondary"
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Filter agents..." />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
            ) : null}
            {visibleAgents.length > 0 ? (
                <CheckboxButtonGroup
                    className="w-full grid-cols-3"
                    isDisabled={disabled}
                    layout="grid"
                    onChange={(nextAgentIds) =>
                        onSelectedAgentIdsChange(normalizeChannelAgentIds(nextAgentIds))
                    }
                    value={selectedAgentIds}
                    variant="secondary"
                >
                    {visibleAgents.map((agent) => (
                        <CheckboxButtonGroup.Item
                            className="flex-row items-center gap-2 rounded-full px-3 py-1.5 data-[selected=true]:border-border data-[selected=true]:bg-accent/20 data-[selected=true]:ring-0"
                            key={agent.id}
                            value={agent.id}
                        >
                            {/* Relative (not static) keeps the checkbox in flow
                                on the left while its selected-state fill stays
                                anchored to the control itself. */}
                            <CheckboxButtonGroup.Indicator className="relative end-auto top-auto" />
                            <CheckboxButtonGroup.ItemContent className="flex-row items-center gap-2">
                                <CheckboxButtonGroup.ItemIcon>
                                    <EntityAvatar
                                        name={agent.name}
                                        size="sm"
                                        src={agent.avatarUrl}
                                    />
                                </CheckboxButtonGroup.ItemIcon>
                                <Label>{agent.name}</Label>
                            </CheckboxButtonGroup.ItemContent>
                        </CheckboxButtonGroup.Item>
                    ))}
                </CheckboxButtonGroup>
            ) : null}
            {!agentsPending && agents.length > 0 && visibleAgents.length === 0 ? (
                <Description>No agents match.</Description>
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
            {!agentsPending && agents.length > 0 && selectedAgentIds.length === 0 ? (
                <Description className="text-danger">Choose at least one Agent.</Description>
            ) : (
                <Description>A channel keeps at least one Agent.</Description>
            )}
        </div>
    );
}

const searchableAgentCount = 8;

export function normalizeChannelAgentIds(agentIds: string[]) {
    return [...new Set(agentIds.map((agentId) => agentId.trim()).filter(Boolean))];
}

function isValidChannelHandle(value: string) {
    return /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u.test(value);
}
