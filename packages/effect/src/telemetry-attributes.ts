export const telemetryAttributeKeys = [
    'grotto.agent.id',
    'grotto.chat.id',
    'grotto.delivery.kind',
    'grotto.failure.kind',
    'grotto.message.count',
    'grotto.model.id',
    'grotto.operation',
    'grotto.outcome',
    'grotto.output.produced',
    'grotto.request.id',
    'grotto.retry.count',
    'grotto.run.id',
    'grotto.runtime.id',
    'grotto.server.id',
    'grotto.reasoning.effort',
    'grotto.turn.harness_ready_ms',
    'grotto.turn.bootstrap_ms',
    'grotto.turn.session_create_ms',
    'grotto.turn.first_stream_ms',
    'grotto.turn.first_tool_ms',
    'grotto.turn.first_send_ms',
    'grotto.turn.last_send_ms',
    'grotto.turn.after_last_send_ms',
    'grotto.tokens.input',
    'grotto.tokens.output',
    'grotto.tokens.cache_read',
    'grotto.tokens.cache_write',
] as const;

export type TelemetryAttributeKey = (typeof telemetryAttributeKeys)[number];
export type TelemetryAttributeValue = boolean | number | string;
export type TelemetryAttributes = Partial<
    Readonly<Record<TelemetryAttributeKey, TelemetryAttributeValue>>
>;

export function sanitizeTelemetryAttributes(
    attributes: Readonly<Record<string, unknown>>
): Record<string, TelemetryAttributeValue> {
    const allowed = new Set<string>(telemetryAttributeKeys);
    return Object.fromEntries(
        Object.entries(attributes).filter(
            (entry): entry is [string, TelemetryAttributeValue] =>
                allowed.has(entry[0]) && ['boolean', 'number', 'string'].includes(typeof entry[1])
        )
    );
}
