import { resolveAgentDefaultCharacter } from '@tavern/api/agent-appearance';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { HostedServerReminders } from '../../features/servers/reminders/hosted-server-reminders.tsx';
import { RequireOperator } from '../../features/servers/require-operator.tsx';

export function ServerRemindersPage() {
    const { agents, server } = useHostedServerContext();
    return (
        <RequireOperator
            description="Reminder schedules are available only to Server operators."
            role={server.role}
        >
            <HostedServerReminders
                agents={agents.map((agent) => ({
                    character: resolveAgentDefaultCharacter(agent.id),
                    id: agent.id,
                    name: agent.displayName,
                    primaryColor: null,
                }))}
                serverId={server.id}
            />
        </RequireOperator>
    );
}
