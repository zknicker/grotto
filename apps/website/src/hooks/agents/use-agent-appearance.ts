import { useMemo } from 'react';
import { useAgentList } from './use-agent-list.ts';

export interface AgentAppearance {
    avatarUrl: string | null;
    primaryColor: string | null;
}

const unknownAppearance: AgentAppearance = { avatarUrl: null, primaryColor: null };

// Resolve an agent id to its uploaded avatar and accent color. Non-agents (and
// unknown ids) resolve to an empty appearance so callers fall back to initials.
export function useAgentAppearanceLookup(): (
    agentId: string | null | undefined
) => AgentAppearance {
    const agentsQuery = useAgentList();
    const agents = agentsQuery.data?.agents;

    return useMemo(() => {
        const appearanceById = new Map<string, AgentAppearance>(
            agents?.map((agent) => [
                agent.id,
                { avatarUrl: agent.avatarUrl, primaryColor: agent.effectivePrimaryColor },
            ])
        );

        return (agentId: string | null | undefined): AgentAppearance =>
            (agentId ? appearanceById.get(agentId) : null) ?? unknownAppearance;
    }, [agents]);
}
