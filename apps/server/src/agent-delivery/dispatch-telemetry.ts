import type { AgentCommand } from '@haus/api';
import { type EffectRuntime, type TraceCarrier, tracePromise } from '@haus/effect';

interface TraceableDispatchPlan {
    frame: AgentCommand;
}

export async function traceAgentDispatch<Plan extends TraceableDispatchPlan>(
    runtime: EffectRuntime<never> | undefined,
    input: { agentId: string; serverId: string },
    plan: () => Promise<Plan | null>
): Promise<Plan | null> {
    if (!runtime) {
        return await plan();
    }
    return await tracePromise(
        runtime,
        'haus.agent.dispatch',
        {
            'haus.agent.id': input.agentId,
            'haus.operation': 'agent.dispatch',
            'haus.server.id': input.serverId,
        },
        async (carrier) => attachTraceCarrier(await plan(), carrier)
    );
}

function attachTraceCarrier<Plan extends TraceableDispatchPlan>(
    plan: Plan | null,
    traceContext: TraceCarrier
): Plan | null {
    if (!plan || plan.frame.type !== 'start') {
        return plan;
    }
    return {
        ...plan,
        frame: { ...plan.frame, traceContext },
    };
}
