import * as React from 'react';
import { useReminderEvents } from '../../../hooks/servers/use-reminder-events.ts';
import { SectionHeader } from '../../shell/section-header.tsx';
import { PageTopbar } from '../../shell/shell-topbar.tsx';
import { ReminderCancelDialog } from './reminder-cancel-dialog.tsx';
import { ReminderFilters } from './reminder-filters.tsx';
import { ReminderList } from './reminder-list.tsx';
import { ReminderRuns } from './reminder-runs.tsx';

export function ReminderPage({ serverId }: { serverId: string }) {
    const connection = useReminderEvents(serverId);
    const [cancelId, setCancelId] = React.useState<string | null>(null);
    const [runsId, setRunsId] = React.useState<string | null>(null);

    return (
        <div className="flex min-h-0 flex-1">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
                <PageTopbar>
                    <SectionHeader title="Reminders">
                        <ReminderFilters connection={connection} serverId={serverId} />
                    </SectionHeader>
                </PageTopbar>
                <ReminderList onCancel={setCancelId} onOpenRuns={setRunsId} serverId={serverId} />
            </section>
            <ReminderRuns onClose={() => setRunsId(null)} reminderId={runsId} serverId={serverId} />
            <ReminderCancelDialog
                onClose={() => setCancelId(null)}
                reminderId={cancelId}
                serverId={serverId}
            />
        </div>
    );
}
