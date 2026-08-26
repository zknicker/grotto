import type { Agent } from '@grotto/api';
import type {
    AgentCreationInitialValues,
    AgentCreationSubmitValues,
    ReportedComputer,
} from './agent-creation-contract.ts';

export function resolveAgentCreationDefaults(
    reported: readonly ReportedComputer[],
    agents: readonly Agent[],
    initialValues?: AgentCreationInitialValues
) {
    const cove = agents.find((agent) => agent.factoryKind === 'cove');
    const preferredComputerId = initialValues?.computerId ?? cove?.computerId;
    const computer =
        reported.find((entry) => entry.id === preferredComputerId) ?? reported[0] ?? null;
    const preferredRuntimeId = initialValues?.runtimeId ?? cove?.desiredRuntimeId;
    const runtime =
        computer?.inventory.runtimes.find((entry) => entry.id === preferredRuntimeId) ??
        computer?.inventory.runtimes[0];
    const preferredModelId = initialValues?.modelId ?? cove?.desiredModelId;
    const model =
        runtime?.models.find((entry) => entry.id === preferredModelId) ?? runtime?.models[0];

    return {
        computerId: computer?.id ?? '',
        modelId: model?.id ?? '',
        reasoningEffort: initialValues?.reasoningEffort ?? cove?.desiredReasoningEffort ?? 'medium',
        runtimeId: runtime?.id ?? '',
    } satisfies Pick<
        AgentCreationSubmitValues,
        'computerId' | 'modelId' | 'reasoningEffort' | 'runtimeId'
    >;
}
