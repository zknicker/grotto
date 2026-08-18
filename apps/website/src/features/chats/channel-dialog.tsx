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
    ScrollShadow,
    SearchField,
    Spinner,
    TextField,
} from '@heroui/react';
import { AlertCircleIcon, HashtagIcon } from '@hugeicons-pro/core-stroke-rounded';
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
            <Modal.Backdrop isDismissable>
                <Modal.Container>
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        {open ? (
                            <ChannelDialogForm
                                agents={agents}
                                agentsPending={agentsPending}
                                errorMessage={errorMessage}
                                initialAgentIds={initialAgentIds}
                                initialDisplayName={initialDisplayName}
                                isPending={isPending}
                                key={`${title}:${initialDisplayName}:${initialAgentIds.join(',')}`}
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

type ChannelDialogFormProps = Omit<ChannelDialogProps, 'onClose' | 'open'>;

function ChannelDialogForm({
    agents,
    agentsPending,
    errorMessage,
    initialAgentIds,
    initialDisplayName,
    isPending,
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
        <>
            <Modal.Header>
                <Modal.Icon className="bg-default text-foreground">
                    <Icon className="size-5" icon={HashtagIcon} />
                </Modal.Icon>
                <Modal.Heading>{title}</Modal.Heading>
                <p className="text-muted text-sm leading-5">
                    {showDisplayName
                        ? 'Name the channel and choose its agents.'
                        : 'Choose the agents in this channel.'}
                </p>
            </Modal.Header>
            <Modal.Body>
                <Form
                    className="flex flex-col gap-6"
                    id="channel-dialog-form"
                    onSubmit={handleSubmit}
                >
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
                    <AgentPicker
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
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button slot="close" type="button" variant="secondary">
                    Cancel
                </Button>
                <Button
                    form="channel-dialog-form"
                    isDisabled={!canSubmit}
                    isPending={isPending}
                    type="submit"
                >
                    {submitLabel}
                </Button>
            </Modal.Footer>
        </>
    );
}

function AgentPicker({
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
    const missingSelection = !agentsPending && agents.length > 0 && selectedAgentIds.length === 0;

    return (
        // CheckboxGroup's own anatomy: Label, Description, the controls, then
        // FieldError. Keeping Label inside gives the group its accessible name,
        // and keeping FieldError outside the scroll area means a validation
        // message cannot scroll out of view behind a long roster.
        <CheckboxGroup
            className="gap-1"
            isDisabled={disabled}
            isInvalid={missingSelection}
            onChange={(nextAgentIds) =>
                onSelectedAgentIdsChange(normalizeChannelAgentIds(nextAgentIds))
            }
            value={selectedAgentIds}
            variant="secondary"
        >
            <Label>Agents</Label>
            <Description>A channel keeps at least one Agent.</Description>
            {agents.length > searchableAgentCount ? (
                <SearchField
                    aria-label="Filter agents"
                    className="mt-1"
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
            {agents.length > 0 ? (
                // Rows, not cards: an Agent is an avatar and a name. Bounded so
                // the dialog is the same size at 2 Agents and at 200.
                <ScrollShadow className="mt-1 max-h-56 overflow-y-auto">
                    <div className="flex flex-col gap-2 **:data-[slot=checkbox]:mt-0">
                        {visibleAgents.map((agent) => (
                            <Checkbox key={agent.id} value={agent.id}>
                                <Checkbox.Content className="items-center gap-3">
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <EntityAvatar
                                        name={agent.name}
                                        size="sm"
                                        src={agent.avatarUrl}
                                    />
                                    {agent.name}
                                </Checkbox.Content>
                            </Checkbox>
                        ))}
                    </div>
                </ScrollShadow>
            ) : null}
            {!agentsPending && agents.length > 0 && visibleAgents.length === 0 ? (
                <Description>No agents match.</Description>
            ) : null}
            {agentsPending ? (
                <div className="mt-1 flex items-center gap-2 text-muted text-sm">
                    <Spinner color="current" size="sm" />
                    Loading agents
                </div>
            ) : null}
            {!agentsPending && agents.length === 0 ? (
                <Description>No agents available.</Description>
            ) : null}
            <FieldError>Choose at least one Agent.</FieldError>
        </CheckboxGroup>
    );
}

const searchableAgentCount = 8;

export function normalizeChannelAgentIds(agentIds: string[]) {
    return [...new Set(agentIds.map((agentId) => agentId.trim()).filter(Boolean))];
}

function isValidChannelHandle(value: string) {
    return /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u.test(value);
}
