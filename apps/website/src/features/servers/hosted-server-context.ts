import type { HostedAgent, HostedChat } from '@tavern/api';
import { useOutletContext } from 'react-router-dom';
import type { ServerDetail, ServerSummary } from '../../lib/grotto-server.tsx';

export interface HostedServerContextValue {
    agents: HostedAgent[];
    chats: HostedChat[];
    server: ServerDetail;
    servers: ServerSummary[];
}

export function useHostedServerContext() {
    return useOutletContext<HostedServerContextValue>();
}
