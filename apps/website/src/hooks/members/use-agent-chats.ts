import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/**
 * Which Chats one Agent is in. Chat membership is event-covered: `chat.lifecycle`
 * fires when a Chat is created, renamed, has its Agent participants replaced, or
 * is archived, unarchived, or deleted, and the Chat event hook invalidates this
 * read for the whole Server.
 */
export function useAgentChats(serverId: string, agentId: string) {
    return grottoTrpc.agent.chats.useQuery({ agentId, serverId }, queryPolicy.syncedSnapshot);
}
