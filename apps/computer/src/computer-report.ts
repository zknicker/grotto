import type { AgentEffectiveState } from '@grotto/api';
import type { EffectiveAgentState } from './effective-state.ts';

export function toReportedAgentState({
    agentId,
    missingResources,
    modelId,
    reasoningEffort,
    runtimeId,
}: EffectiveAgentState): AgentEffectiveState {
    return { agentId, missingResources, modelId, reasoningEffort, runtimeId };
}
