import { Button } from '@heroui/react';
import { useReminderRuns } from '../../../hooks/servers/use-reminder-runs.ts';
import { useReminders } from '../../../hooks/servers/use-reminders.ts';
import { formatTimestamp } from '../../../lib/format.ts';

export function ReminderRuns({
    onClose,
    reminderId,
    serverId,
}: {
    onClose: () => void;
    reminderId: string | null;
    serverId: string;
}) {
    const reminders = useReminders(serverId);
    const runs = useReminderRuns(serverId, reminderId);
    const reminder = reminders.data?.find((item) => item.id === reminderId);

    if (!reminderId) {
        return null;
    }

    return (
        <aside className="flex w-80 shrink-0 flex-col border-separator border-l">
            <header className="flex h-10 shrink-0 items-center gap-2 border-separator border-b px-3">
                <h2 className="min-w-0 truncate font-medium text-sm">
                    Fire Log
                    {reminder ? (
                        <span className="ms-2 font-normal text-muted">{reminder.title}</span>
                    ) : null}
                </h2>
                <Button className="ms-auto" onPress={onClose} size="sm" variant="ghost">
                    Close
                </Button>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {runs.isPending ? (
                    <p className="text-muted text-sm">Loading fire log…</p>
                ) : runs.error ? (
                    <p className="text-danger text-sm" role="alert">
                        {runs.error.message}
                    </p>
                ) : runs.data?.length ? (
                    runs.data.map((run) => (
                        <div key={run.id}>
                            <p className="text-foreground text-sm">
                                Fired {formatTimestamp(run.firedAt)}
                            </p>
                            <p className="text-muted text-xs">
                                Scheduled {formatTimestamp(run.scheduledFor)}
                            </p>
                        </div>
                    ))
                ) : (
                    <p className="text-muted text-sm">No fires yet.</p>
                )}
            </div>
        </aside>
    );
}
