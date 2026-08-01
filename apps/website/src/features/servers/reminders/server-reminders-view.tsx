import { Alert, Button, Chip, Label, ListBox, SearchField, Select } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import type { ServerReminderConnectionState } from '../../../hooks/servers/use-server-reminder-events.ts';
import { formatTimestamp } from '../../../lib/format.ts';
import type { GrottoOutputs } from '../../../lib/grotto-server.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../../agents/agent-option-label.tsx';
import { SectionHeader } from '../../shell/section-header.tsx';
import { PageTopbar } from '../../shell/shell-topbar.tsx';
import type { HostedReminderListItem } from './server-reminder-view-model.ts';

type ReminderRun = GrottoOutputs['reminder']['runs'][number];
type ReminderStatus = 'all' | 'canceled' | 'fired' | 'scheduled';

const statusFilterLabels: Record<ReminderStatus, string> = {
    all: 'All Statuses',
    canceled: 'Canceled',
    fired: 'Fired',
    scheduled: 'Scheduled',
};

const statusFilters = Object.keys(statusFilterLabels) as ReminderStatus[];

interface ServerRemindersViewProps {
    actionErrorMessage: string | null;
    activeCancelId: string | null;
    agentId: string | null;
    agents: AgentSelectOption[];
    connectionState: ServerReminderConnectionState;
    isPending: boolean;
    onAgentChange: (agentId: string | null) => void;
    onCancel: (reminder: HostedReminderListItem) => void;
    onCloseRuns: () => void;
    onOpenRuns: (reminder: HostedReminderListItem) => void;
    onQueryChange: (query: string) => void;
    onStatusChange: (status: ReminderStatus) => void;
    query: string;
    reminders: HostedReminderListItem[];
    runs: ReminderRun[];
    runsPending: boolean;
    selectedReminder: HostedReminderListItem | null;
    status: ReminderStatus;
}

export function ServerRemindersView({
    actionErrorMessage,
    activeCancelId,
    agentId,
    agents,
    connectionState,
    isPending,
    onAgentChange,
    onCancel,
    onCloseRuns,
    onOpenRuns,
    onQueryChange,
    onStatusChange,
    query,
    reminders,
    runs,
    runsPending,
    selectedReminder,
    status,
}: ServerRemindersViewProps) {
    const selectedAgent = agents.find((agent) => agent.id === agentId) ?? null;

    return (
        <div className="flex min-h-0 flex-1">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
                <PageTopbar>
                    <SectionHeader title="Reminders">
                        <Select
                            aria-label="Filter by agent"
                            onChange={(value) =>
                                onAgentChange(value === 'all' ? null : String(value))
                            }
                            value={agentId ?? 'all'}
                            variant="secondary"
                        >
                            <Select.Trigger>
                                <Select.Value>
                                    {selectedAgent ? (
                                        <AgentOptionLabel agent={selectedAgent} />
                                    ) : (
                                        'All Agents'
                                    )}
                                </Select.Value>
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    <ListBox.Item id="all" textValue="All Agents">
                                        <Label>All Agents</Label>
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    {agents.map((agent) => (
                                        <ListBox.Item
                                            id={agent.id}
                                            key={agent.id}
                                            textValue={agent.name}
                                        >
                                            <Label>
                                                <AgentOptionLabel agent={agent} />
                                            </Label>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                        <Select
                            aria-label="Filter by status"
                            onChange={(value) => onStatusChange(String(value) as ReminderStatus)}
                            value={status}
                            variant="secondary"
                        >
                            <Select.Trigger>
                                <Select.Value>{statusFilterLabels[status]}</Select.Value>
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {statusFilters.map((value) => (
                                        <ListBox.Item
                                            id={value}
                                            key={value}
                                            textValue={statusFilterLabels[value]}
                                        >
                                            <Label>{statusFilterLabels[value]}</Label>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                        <SearchField
                            aria-label="Search hosted reminders"
                            className="min-w-48 flex-1"
                            onChange={onQueryChange}
                            value={query}
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input placeholder="Search reminders..." />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                        {connectionState === 'connected' ? null : (
                            <span className="ms-auto shrink-0 whitespace-nowrap text-muted text-xs">
                                Reconnecting · showing last hosted state
                            </span>
                        )}
                    </SectionHeader>
                </PageTopbar>
                {actionErrorMessage ? (
                    <div className="px-6 pt-4">
                        <Alert role="alert" status="danger">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Description>{actionErrorMessage}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    </div>
                ) : null}
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    {isPending ? (
                        <p className="text-muted text-sm">Loading reminders…</p>
                    ) : reminders.length === 0 ? (
                        <EmptyState>
                            <EmptyState.Header>
                                <EmptyState.Title>No hosted reminders</EmptyState.Title>
                                <EmptyState.Description>
                                    Agents schedule reminders from messages and Threads. There is no
                                    creation or execution control on this operator page.
                                </EmptyState.Description>
                            </EmptyState.Header>
                        </EmptyState>
                    ) : (
                        <ul className="grid gap-px overflow-hidden rounded-xl border border-separator">
                            {reminders.map((reminder) => (
                                <ReminderRow
                                    isCanceling={activeCancelId === reminder.id}
                                    key={reminder.id}
                                    onCancel={onCancel}
                                    onOpenRuns={onOpenRuns}
                                    reminder={reminder}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </section>
            {selectedReminder ? (
                <aside className="flex w-80 shrink-0 flex-col border-separator border-l">
                    <header className="flex h-10 shrink-0 items-center gap-2 border-separator border-b px-3">
                        <h2 className="min-w-0 truncate font-medium text-sm">
                            Fire Log
                            <span className="ms-2 font-normal text-muted">
                                {selectedReminder.title}
                            </span>
                        </h2>
                        <Button className="ms-auto" onPress={onCloseRuns} size="sm" variant="ghost">
                            Close
                        </Button>
                    </header>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                        {runsPending ? (
                            <p className="text-muted text-sm">Loading fire log…</p>
                        ) : runs.length === 0 ? (
                            <p className="text-muted text-sm">No fires yet.</p>
                        ) : (
                            runs.map((run) => (
                                <div key={run.id}>
                                    <p className="text-foreground text-sm">
                                        Fired {formatTimestamp(run.firedAt)}
                                    </p>
                                    <p className="text-muted text-xs">
                                        Scheduled {formatTimestamp(run.scheduledFor)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </aside>
            ) : null}
        </div>
    );
}

function ReminderRow({
    isCanceling,
    onCancel,
    onOpenRuns,
    reminder,
}: {
    isCanceling: boolean;
    onCancel: (reminder: HostedReminderListItem) => void;
    onOpenRuns: (reminder: HostedReminderListItem) => void;
    reminder: HostedReminderListItem;
}) {
    return (
        <li className="flex flex-wrap items-center gap-3 bg-surface px-4 py-3">
            <StatusDot status={reminder.status === 'scheduled' ? 'success' : 'muted'} />
            <div className="min-w-52 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground text-sm">{reminder.title}</h3>
                    <Chip
                        color={reminder.status === 'scheduled' ? 'success' : 'default'}
                        size="sm"
                        variant="soft"
                    >
                        {reminder.status}
                    </Chip>
                </div>
                <p className="text-muted text-xs">
                    {reminder.ownerLabel} · {reminder.schedule}
                </p>
                {reminder.scriptLabel ? (
                    <p className="mt-1 font-mono text-muted text-xs">{reminder.scriptLabel}</p>
                ) : null}
            </div>
            <Button onPress={() => onOpenRuns(reminder)} size="sm" variant="ghost">
                Fire Log
            </Button>
            {reminder.status === 'scheduled' ? (
                <Button
                    isPending={isCanceling}
                    onPress={() => onCancel(reminder)}
                    size="sm"
                    variant="danger-soft"
                >
                    Cancel Reminder
                </Button>
            ) : null}
        </li>
    );
}
