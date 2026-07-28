import { HostedOverview } from '../../features/overview/hosted-overview.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';

export function ServerActivityPage() {
    const { agents, chats, server } = useHostedServerContext();
    return <HostedOverview agents={agents} chats={chats} slug={server.slug} />;
}
