import { type TraceCarrier, tracePromise } from '@grotto/effect';
import type { DaemonRuntime } from './daemon-runtime.ts';
import type { AgentStartCommand } from './launch.ts';

export function parseTurnTraceContext(value: unknown): TraceCarrier | null {
    if (
        !(
            value &&
            typeof value === 'object' &&
            'traceparent' in value &&
            typeof value.traceparent === 'string'
        )
    ) {
        return null;
    }
    return /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/u.test(value.traceparent)
        ? { traceparent: value.traceparent }
        : null;
}

export function traceAgentTurn<
    Result extends {
        readonly failureKind?: string;
        readonly messageCount: number;
        readonly outputProduced: boolean;
        readonly status: 'completed' | 'failed' | 'interrupted';
    },
>(
    runtime: DaemonRuntime,
    command: Pick<
        AgentStartCommand,
        'agentId' | 'chatId' | 'modelId' | 'runId' | 'runtimeId' | 'traceContext'
    >,
    operation: (traceContext: TraceCarrier) => Promise<Result>
): Promise<Result> {
    return tracePromise(
        runtime,
        'grotto.agent.turn',
        {
            'grotto.agent.id': command.agentId,
            'grotto.chat.id': command.chatId,
            'grotto.model.id': command.modelId,
            'grotto.operation': 'agent.turn',
            'grotto.run.id': command.runId,
            'grotto.runtime.id': command.runtimeId,
        },
        operation,
        command.traceContext,
        (result) => ({
            ...(result.failureKind ? { 'grotto.failure.kind': result.failureKind } : {}),
            'grotto.message.count': result.messageCount,
            'grotto.outcome': result.status,
            'grotto.output.produced': result.outputProduced,
        }),
        (result) => {
            switch (result.status) {
                case 'completed':
                    return 'success';
                case 'failed':
                    return 'failure';
                case 'interrupted':
                    return 'interruption';
            }
        }
    );
}
