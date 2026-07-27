import * as React from 'react';
import { useServerReminderEvents } from '../../../hooks/servers/use-server-reminder-events.ts';
import {
    useCancelServerReminder,
    useServerReminderRuns,
    useServerReminders,
} from '../../../hooks/servers/use-server-reminders.ts';
import { CancelReminderDialog } from '../../reminders/cancel-reminder-dialog.tsx';
import {
    filterHostedReminders,
    type HostedReminderFilters,
    type HostedReminderListItem,
    toHostedReminderListItem,
} from './server-reminder-view-model.ts';
import { ServerRemindersView } from './server-reminders-view.tsx';

export function HostedServerReminders({ serverId }: { serverId: string }) {
    const [filters, setFilters] = React.useState<HostedReminderFilters>({
        agentId: null,
        query: '',
        status: 'all',
    });
    const [cancelReminder, setCancelReminder] = React.useState<HostedReminderListItem | null>(null);
    const [runsReminder, setRunsReminder] = React.useState<HostedReminderListItem | null>(null);
    const remindersQuery = useServerReminders(serverId);
    const runsQuery = useServerReminderRuns(serverId, runsReminder?.id ?? null);
    const cancelMutation = useCancelServerReminder();
    const connectionState = useServerReminderEvents(serverId);
    const reminders = React.useMemo(
        () =>
            filterHostedReminders(remindersQuery.data ?? [], filters).map(toHostedReminderListItem),
        [filters, remindersQuery.data]
    );

    const closeCancelDialog = () => {
        if (!cancelMutation.isPending) {
            cancelMutation.reset();
            setCancelReminder(null);
        }
    };
    return (
        <>
            <ServerRemindersView
                actionErrorMessage={reminderActionErrorMessage(
                    cancelMutation.error,
                    remindersQuery.error
                )}
                activeCancelId={cancelMutation.isPending ? (cancelReminder?.id ?? null) : null}
                agentId={filters.agentId}
                connectionState={connectionState}
                isPending={remindersQuery.isPending}
                onAgentChange={(agentId) => setFilters((current) => ({ ...current, agentId }))}
                onCancel={setCancelReminder}
                onCloseRuns={() => setRunsReminder(null)}
                onOpenRuns={setRunsReminder}
                onQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
                onStatusChange={(status) => setFilters((current) => ({ ...current, status }))}
                query={filters.query}
                reminders={reminders}
                runs={runsQuery.data ?? []}
                runsPending={runsQuery.isPending}
                selectedReminder={runsReminder}
                status={filters.status}
            />
            <CancelReminderDialog
                errorMessage={cancelMutation.error?.message ?? null}
                isOpen={cancelReminder !== null}
                isPending={cancelMutation.isPending}
                onClose={closeCancelDialog}
                onConfirm={async () => {
                    if (!cancelReminder) {
                        return;
                    }
                    await cancelMutation.mutateAsync({
                        commandId: crypto.randomUUID(),
                        expectedVersion: cancelReminder.version,
                        reminderId: cancelReminder.id,
                        serverId,
                    });
                    setCancelReminder(null);
                }}
                reminderName={cancelReminder?.title ?? null}
            />
        </>
    );
}

export function reminderActionErrorMessage(
    cancelError: { message: string } | null,
    listError: { message: string } | null
): string | null {
    return cancelError?.message ?? listError?.message ?? null;
}
