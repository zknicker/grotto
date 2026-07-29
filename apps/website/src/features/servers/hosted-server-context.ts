import type { HostedAgent, HostedChat } from '@tavern/api';
import { useOutletContext } from 'react-router-dom';
import type { HostedAgentLifecycles } from '../../hooks/servers/use-server-agent-lifecycle.ts';
import type { ServerDetail, ServerSummary } from '../../lib/grotto-server.tsx';

export interface HostedServerContextValue {
    agentLifecycles: HostedAgentLifecycles;
    agentListStatus: 'error' | 'loading' | 'ready';
    agents: HostedAgent[];
    chats: HostedChat[];
    server: ServerDetail;
    servers: ServerSummary[];
}

export function useHostedServerContext() {
    return useOutletContext<HostedServerContextValue>();
}
