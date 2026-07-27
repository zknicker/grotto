import { Badge } from '../../../components/ui/badge.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import type { ServerReminderConnectionState } from '../../../hooks/servers/use-server-reminder-events.ts';
import { formatTimestamp } from '../../../lib/format.ts';
import type { GrottoOutputs } from '../../../lib/grotto-server.tsx';
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
                <div className="flex flex-wrap items-center gap-2 border-border border-b px-6 py-3">
                    <SearchInput
                        aria-label="Search hosted reminders"
                        className="min-w-56 flex-1 sm:max-w-72"
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Search reminders..."
                        size="default"
                        value={query}
                    />
                    <StatusFilters onChange={onStatusChange} value={status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 border-border border-b px-6 py-2">
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
                    <span className="ml-auto text-muted-foreground text-xs">
                        {connectionState === 'connected'
                            ? 'Hosted state catches up after reconnect'
                            : 'Reconnecting · showing last hosted state'}
                    </span>
                </div>
                {actionErrorMessage ? (
                    <p className="border-error/40 border-b bg-error-bg px-6 py-3 text-error-foreground text-sm">
                        {actionErrorMessage}
                    </p>
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
                                <article
                                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                                    key={reminder.id}
                                >
                                    <span
                                        className={`size-2 rounded-full ${
                                            reminder.status === 'scheduled'
                                                ? 'bg-success'
                                                : 'bg-muted-foreground/35'
                                        }`}
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
                                        <p className="text-muted-foreground text-xs">
                                            {reminder.ownerLabel} · {reminder.schedule}
                                        </p>
                                        {reminder.scriptLabel ? (
                                            <p className="mt-1 font-mono text-muted-foreground text-xs">
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
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
            {selectedReminder ? (
                <aside className="w-80 shrink-0 border-border border-l bg-sidebar p-5">
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
                                <div
                                    className="rounded-lg border border-border bg-card p-3 text-sm"
                                    key={run.id}
                                >
                                    <p className="text-foreground">
                                        Fired {formatTimestamp(run.firedAt)}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
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
