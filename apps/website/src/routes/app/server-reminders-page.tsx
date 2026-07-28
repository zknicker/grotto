import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { HostedServerReminders } from '../../features/servers/reminders/hosted-server-reminders.tsx';

export function ServerRemindersPage() {
    const { server } = useHostedServerContext();
    if (server.role !== 'owner' && server.role !== 'admin') {
        return (
            <div className="grid flex-1 place-content-center gap-1 px-6 text-center">
                <h2 className="font-medium text-foreground">Owner or Admin required</h2>
                <p className="max-w-sm text-muted-foreground text-sm">
                    Reminder schedules are available only to Server operators.
                </p>
            </div>
        );
    }
    return <HostedServerReminders serverId={server.id} />;
}
