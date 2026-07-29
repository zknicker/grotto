import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { HostedServerReminders } from '../../features/servers/reminders/hosted-server-reminders.tsx';
import { RequireOperator } from '../../features/servers/require-operator.tsx';

export function ServerRemindersPage() {
    const { server } = useHostedServerContext();
    return (
        <RequireOperator
            description="Reminder schedules are available only to Server operators."
            role={server.role}
        >
            <HostedServerReminders serverId={server.id} />
        </RequireOperator>
    );
}
