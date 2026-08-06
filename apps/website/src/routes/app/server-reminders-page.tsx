import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { ReminderPage } from '../../features/servers/reminders/reminder-page.tsx';
import { RequireOperator } from '../../features/servers/require-operator.tsx';

export function ServerRemindersPage() {
    const { server } = useHostedServerContext();
    return (
        <RequireOperator
            description="Reminder schedules are available only to Server operators."
            role={server.role}
        >
            <ReminderPage serverId={server.id} />
        </RequireOperator>
    );
}
