import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { Badge } from '../../../components/ui/badge.tsx';
import {
    Pane,
    PaneBody,
    PaneTopbar,
    PaneTopbarTitle,
    SidePane,
} from '../../../components/ui/pane.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import { Elevated } from '../../../components/ui/surface.tsx';
import type { ServerReminderConnectionState } from '../../../hooks/servers/use-server-reminder-events.ts';
import { formatTimestamp } from '../../../lib/format.ts';
import type { GrottoOutputs } from '../../../lib/grotto-server.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../../agents/agent-option-label.tsx';
import type { HostedReminderListItem } from './server-reminder-view-model.ts';

type ReminderRun = GrottoOutputs['reminder']['runs'][number];
type ReminderStatus = 'all' | 'canceled' | 'fired' | 'scheduled';

const statusFilterLabels: Record<ReminderStatus, string> = {
    all: 'All statuses',
    canceled: 'Canceled',
    fired: 'Fired',
    scheduled: 'Scheduled',
};

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
            <Pane>
                <PaneTopbar className="no-drag">
                    <Select
                        onValueChange={(value) => {
                            onAgentChange(value === 'all' ? null : value);
                        }}
                        value={agentId ?? 'all'}
                    >
                        <SelectTrigger aria-label="Filter by agent" className="w-44">
                            <SelectValue>
                                {selectedAgent ? (
                                    <AgentOptionLabel agent={selectedAgent} />
                                ) : (
                                    'All Agents'
                                )}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Agents</SelectItem>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                    <AgentOptionLabel agent={agent} />
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        onValueChange={(value) => {
                            if (value) {
                                onStatusChange(value as ReminderStatus);
                            }
                        }}
                        value={status}
                    >
                        <SelectTrigger aria-label="Filter by status" className="w-36">
                            <SelectValue>{statusFilterLabels[status]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(statusFilterLabels) as ReminderStatus[]).map((value) => (
                                <SelectItem key={value} value={value}>
                                    {statusFilterLabels[value]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <SearchInput
                        aria-label="Search hosted reminders"
                        className="w-full max-w-96"
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Search reminders..."
                        size="default"
                        value={query}
                    />
                    {connectionState === 'connected' ? null : (
                        <span className="ml-auto shrink-0 whitespace-nowrap text-meta text-muted-foreground">
                            Reconnecting · showing last hosted state
                        </span>
                    )}
                </PaneTopbar>
                {actionErrorMessage ? (
                    <Alert className="rounded-none border-x-0 border-t-0" variant="error">
                        <AlertDescription>{actionErrorMessage}</AlertDescription>
                    </Alert>
                ) : null}
                <PaneBody className="overflow-y-auto px-6 py-5">
                    {isPending ? (
                        <p className="text-muted-foreground text-sm">Loading reminders…</p>
                    ) : reminders.length === 0 ? (
                        <div className="grid min-h-52 place-content-center gap-1 text-center">
                            <h2 className="font-medium text-foreground">No hosted reminders</h2>
                            <p className="max-w-sm text-muted-foreground text-sm">
                                Agents schedule reminders from messages and Threads. There is no
                                creation or execution control on this operator page.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {reminders.map((reminder) => (
                                <Elevated
                                    className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
                                    key={reminder.id}
                                    offset={1}
                                >
                                    <StatusDot
                                        status={
                                            reminder.status === 'scheduled' ? 'success' : 'muted'
                                        }
                                    />
                                    <div className="min-w-52 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-medium text-foreground text-sm">
                                                {reminder.title}
                                            </h3>
                                            <Badge
                                                variant={
                                                    reminder.status === 'scheduled'
                                                        ? 'success'
                                                        : 'subtle'
                                                }
                                            >
                                                {reminder.status}
                                            </Badge>
                                        </div>
                                        <p className="text-meta text-muted-foreground">
                                            {reminder.ownerLabel} · {reminder.schedule}
                                        </p>
                                        {reminder.scriptLabel ? (
                                            <p className="mt-1 font-mono text-meta text-muted-foreground">
                                                {reminder.scriptLabel}
                                            </p>
                                        ) : null}
                                    </div>
                                    <Button
                                        onClick={() => onOpenRuns(reminder)}
                                        size="sm"
                                        variant="ghost"
                                    >
                                        Fire log
                                    </Button>
                                    {reminder.status === 'scheduled' ? (
                                        <Button
                                            loading={activeCancelId === reminder.id}
                                            onClick={() => onCancel(reminder)}
                                            size="sm"
                                            variant="destructive-ghost"
                                        >
                                            Cancel reminder
                                        </Button>
                                    ) : null}
                                </Elevated>
                            ))}
                        </div>
                    )}
                </PaneBody>
            </Pane>
            {selectedReminder ? (
                <SidePane className="w-80 flex-col bg-sidebar">
                    <PaneTopbar className="bg-transparent">
                        <PaneTopbarTitle className="font-medium">
                            Fire log
                            <span className="ml-2 font-normal text-muted-foreground">
                                {selectedReminder.title}
                            </span>
                        </PaneTopbarTitle>
                        <Button className="ml-auto" onClick={onCloseRuns} size="xs" variant="ghost">
                            Close
                        </Button>
                    </PaneTopbar>
                    <PaneBody className="gap-3 overflow-y-auto p-4">
                        {runsPending ? (
                            <p className="text-muted-foreground text-sm">Loading fire log…</p>
                        ) : runs.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No fires yet.</p>
                        ) : (
                            runs.map((run) => (
                                <Elevated
                                    className="rounded-lg border p-3 text-sm"
                                    key={run.id}
                                    offset={1}
                                >
                                    <p className="text-foreground">
                                        Fired {formatTimestamp(run.firedAt)}
                                    </p>
                                    <p className="text-meta text-muted-foreground">
                                        Scheduled {formatTimestamp(run.scheduledFor)}
                                    </p>
                                </Elevated>
                            ))
                        )}
                    </PaneBody>
                </SidePane>
            ) : null}
        </div>
    );
}
