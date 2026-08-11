import { grottoTrpc } from '../../lib/grotto-server.tsx';

/**
 * Which Chats one Agent is in. Deliberately unpoliced: nothing invalidates this
 * read, because Chat membership changes do not raise a Server update event. It
 * relies on the app-wide staleness floor so reopening the profile after that
 * window refetches, which a `syncedSnapshot` policy would suppress forever.
 */
export function useAgentChats(serverId: string, agentId: string) {
    return grottoTrpc.agent.chats.useQuery({ agentId, serverId });
}
