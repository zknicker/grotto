import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { Badge } from '../../../components/ui/badge.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import { Elevated } from '../../../components/ui/surface.tsx';
import type { ServerReminderConnectionState } from '../../../hooks/servers/use-server-reminder-events.ts';
import { formatTimestamp } from '../../../lib/format.ts';
import type { GrottoOutputs } from '../../../lib/grotto-server.tsx';
import { ContentTopbar } from '../../shell/content-topbar.tsx';
import type { HostedReminderListItem } from './server-reminder-view-model.ts';

type ReminderRun = GrottoOutputs['reminder']['runs'][number];
type ReminderStatus = 'all' | 'canceled' | 'fired' | 'scheduled';

interface ServerRemindersViewProps {
    actionErrorMessage: string | null;
    activeCancelId: string | null;
    agentId: string | null;
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
    const agents = [
        ...new Map(
            reminders.map((reminder) => [
                reminder.ownerAgentId,
                {
                    id: reminder.ownerAgentId,
                    label: reminder.ownerLabel,
                },
            ])
        ).values(),
    ];
    return (
        <div className="flex min-h-0 flex-1">
            <section className="flex min-w-0 flex-1 flex-col">
                <ContentTopbar className="no-drag">
                    <SearchInput
                        aria-label="Search hosted reminders"
                        className="min-w-56 flex-1 sm:max-w-72"
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Search reminders..."
                        size="default"
                        value={query}
                    />
                    <StatusFilters onChange={onStatusChange} value={status} />
                </ContentTopbar>
                {/* Second chrome row: same 40px band and seam as the topbar. */}
                <div className="flex h-[var(--content-topbar-height)] shrink-0 items-center gap-2 overflow-x-auto border-[var(--content-card-border)] border-b px-3">
                    <Button
                        onClick={() => onAgentChange(null)}
                        size="xs"
                        variant={agentId === null ? 'secondary' : 'ghost'}
                    >
                        All Agents
                    </Button>
                    {agents.map((agent) => (
                        <Button
                            key={agent.id}
                            onClick={() => onAgentChange(agent.id)}
                            size="xs"
                            variant={agentId === agent.id ? 'secondary' : 'ghost'}
                        >
                            {agent.label}
                        </Button>
                    ))}
                    <span className="ml-auto shrink-0 whitespace-nowrap text-meta text-muted-foreground">
                        {connectionState === 'connected'
                            ? 'Hosted state catches up after reconnect'
                            : 'Reconnecting · showing last hosted state'}
                    </span>
                </div>
                {actionErrorMessage ? (
                    <Alert className="rounded-none border-x-0 border-t-0" variant="error">
                        <AlertDescription className="text-error-foreground">
                            {actionErrorMessage}
                        </AlertDescription>
                    </Alert>
                ) : null}
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                </div>
            </section>
            {selectedReminder ? (
                <aside className="w-80 shrink-0 border-[var(--content-card-border)] border-l bg-sidebar p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-mono text-muted-foreground text-xs uppercase">
                                Fire log
                            </p>
                            <h2 className="font-medium text-foreground">
                                {selectedReminder.title}
                            </h2>
                        </div>
                        <Button onClick={onCloseRuns} size="xs" variant="ghost">
                            Close
                        </Button>
                    </div>
                    <div className="mt-5 grid gap-3">
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
                    </div>
                </aside>
            ) : null}
        </div>
    );
}

function StatusFilters({
    onChange,
    value,
}: {
    onChange: (status: ReminderStatus) => void;
    value: ReminderStatus;
}) {
    const statuses: ReminderStatus[] = ['all', 'scheduled', 'fired', 'canceled'];
    return statuses.map((status) => (
        <Button
            key={status}
            onClick={() => onChange(status)}
            size="xs"
            variant={value === status ? 'secondary' : 'ghost'}
        >
            {status === 'all' ? 'All' : status}
        </Button>
    ));
}
