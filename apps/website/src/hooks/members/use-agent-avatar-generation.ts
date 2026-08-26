import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Runs the Server-owned transient preview operation for one editable Agent. */
export function useAgentAvatarGeneration(serverId: string, agentId: string) {
    const mutation = grottoTrpc.avatar.generate.useMutation();
    const generate = React.useCallback(
        (concept: string) => mutation.mutateAsync({ agentId, concept, serverId }),
        [agentId, mutation.mutateAsync, serverId]
    );

    return { ...mutation, generate };
}
