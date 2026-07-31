import * as React from 'react';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Checkbox } from '../../components/ui/checkbox.tsx';
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
import { Field, FieldDescription, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { cn } from '../../lib/utils.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from './agent-face.tsx';

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
        <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
            <DialogContent className="max-w-lg" showCloseButton={false}>
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
            </DialogContent>
        </Dialog>
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
    const displayNameInputId = React.useId();
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
        <Form className="contents" onSubmit={handleSubmit}>
            <DialogHeader className="pe-6">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                    {showDisplayName
                        ? 'Name the channel and choose its agents.'
                        : 'Choose the agents in this channel.'}
                </DialogDescription>
            </DialogHeader>
            <DialogPanel className="grid gap-4">
                {showDisplayName ? (
                    <Field>
                        <FieldLabel htmlFor={displayNameInputId}>Channel name</FieldLabel>
                        <Input
                            autoFocus
                            id={displayNameInputId}
                            onChange={(event) => setDisplayName(event.target.value)}
                            placeholder="planning"
                            type="text"
                            value={displayName}
                        />
                        {handleIssue ? (
                            <p className="text-meta text-muted-foreground">{handleIssue}</p>
                        ) : null}
                    </Field>
                ) : null}
                <Field>
                    <FieldLabel>Agents</FieldLabel>
                    <AgentCheckboxList
                        agents={agents}
                        disabled={isPending}
                        onSelectedAgentIdsChange={setSelectedAgentIds}
                        selectedAgentIds={selectedAgentIds}
                    />
                    {agentsPending ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Spinner className="size-3.5" />
                            Loading agents
                        </div>
                    ) : null}
                    {!agentsPending && agents.length === 0 ? (
                        <FieldDescription>No agents available.</FieldDescription>
                    ) : null}
                </Field>
                {errorMessage ? (
                    <Alert variant="error">
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                ) : null}
            </DialogPanel>
            <DialogFooter variant="bare">
                <Button onClick={onClose} size="sm" type="button" variant="ghost">
                    Cancel
                </Button>
                <Button disabled={!canSubmit} loading={isPending} size="sm" type="submit">
                    {submitLabel}
                </Button>
            </DialogFooter>
        </Form>
    );
}

function AgentCheckboxList({
    agents,
    disabled,
    onSelectedAgentIdsChange,
    selectedAgentIds,
}: {
    agents: ChannelAgentOption[];
    disabled: boolean;
    onSelectedAgentIdsChange: (agentIds: string[]) => void;
    selectedAgentIds: string[];
}) {
    const selectedAgentIdSet = React.useMemo(() => new Set(selectedAgentIds), [selectedAgentIds]);

    return (
        <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-lg border border-border-subtle bg-legacy-muted p-1.5">
            {agents.map((agent) => {
                const checked = selectedAgentIdSet.has(agent.id);

                return (
                    <AgentCheckboxRow
                        agent={agent}
                        checked={checked}
                        disabled={disabled}
                        key={agent.id}
                        onCheckedChange={(nextChecked) => {
                            if (!nextChecked && selectedAgentIds.length <= 1) {
                                return;
                            }

                            onSelectedAgentIdsChange(
                                nextChecked
                                    ? normalizeChannelAgentIds([...selectedAgentIds, agent.id])
                                    : selectedAgentIds.filter((agentId) => agentId !== agent.id)
                            );
                        }}
                    />
                );
            })}
        </div>
    );
}

function AgentCheckboxRow({
    agent,
    checked,
    disabled,
    onCheckedChange,
}: {
    agent: ChannelAgentOption;
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    const checkboxId = React.useId();

    return (
        <label
            className={cn(
                'flex min-w-0 cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm outline-none transition-[background-color,box-shadow] hover:bg-sidebar-accent has-focus-visible:ring-2 has-focus-visible:ring-ring',
                checked && 'bg-sidebar-accent text-sidebar-accent-foreground',
                disabled && 'cursor-default opacity-64'
            )}
            htmlFor={checkboxId}
        >
            <Checkbox
                checked={checked}
                className="order-last ms-auto"
                disabled={disabled}
                id={checkboxId}
                onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
            />
            <AgentAvatar agent={agent} />
            <span className="min-w-0 flex-1 truncate">{agent.name}</span>
        </label>
    );
}

function AgentAvatar({ agent }: { agent: ChannelAgentOption }) {
    const dark = useResolvedThemeOptional() === 'dark';

    return (
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
            <AgentFace
                animate={false}
                dark={dark}
                head={agent.effectiveCharacter}
                ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                size={24}
                style={{ flexShrink: 0, height: 24, overflow: 'visible', width: 24 }}
            />
        </span>
    );
}

export function normalizeChannelAgentIds(agentIds: string[]) {
    return [...new Set(agentIds.map((agentId) => agentId.trim()).filter(Boolean))];
}

function isValidChannelHandle(value: string) {
    return /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u.test(value);
}
