import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

/**
 * When one Agent session generation began, and why.
 *
 * Read lazily: a busy transcript can carry many session marks, and nobody
 * wants the reason for a restart until they point at one. `NOT_FOUND` is
 * ordinary here — the first generation has no rotation before it, and history
 * predating the rotation record has none either — so the card states what it
 * knows rather than treating an absent record as a failure.
 */
export function useAgentSessionRotation({
    agentId,
    enabled,
    generation,
    serverId,
}: {
    agentId: string;
    enabled: boolean;
    generation: number;
    serverId: string;
}) {
    return grottoTrpc.agent.sessionRotation.useQuery(
        { agentId, generation, serverId },
        { ...queryPolicy.syncedSnapshot, enabled }
    );
}
