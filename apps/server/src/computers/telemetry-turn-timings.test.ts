import { expect, test } from 'bun:test';
import { sanitizeComputerTelemetry } from './telemetry-payload.ts';
import { telemetryProtobuf } from './telemetry-protobuf.ts';

test('relays bounded numeric timing and usage without accepting content as a measurement', () => {
    const codec = telemetryProtobuf.traces;
    const attributes = [
        { key: 'grotto.reasoning.effort', value: { stringValue: 'medium' } },
        { key: 'grotto.turn.session_create_ms', value: { doubleValue: 12.5 } },
        { key: 'grotto.turn.first_send_ms', value: { intValue: '20' } },
        { key: 'grotto.tokens.input', value: { intValue: '100' } },
        { key: 'grotto.tokens.output', value: { doubleValue: 0 } },
        { key: 'grotto.turn.first_stream_ms', value: { stringValue: 'secret' } },
        { key: 'grotto.turn.last_send_ms', value: { doubleValue: -1 } },
        { key: 'grotto.turn.after_last_send_ms', value: { doubleValue: 604_800_001 } },
        { key: 'grotto.tokens.cache_read', value: { doubleValue: 1.5 } },
        { key: 'grotto.tokens.cache_write', value: { stringValue: 'secret' } },
        { key: 'grotto.turn.arbitrary', value: { stringValue: 'secret' } },
    ];
    const payload = codec
        .encode(
            codec.fromObject({
                resourceSpans: [
                    {
                        scopeSpans: [
                            {
                                spans: [
                                    {
                                        traceId: Buffer.alloc(16, 1),
                                        spanId: Buffer.alloc(8, 2),
                                        name: 'grotto.agent.turn',
                                        startTimeUnixNano: '1000000000',
                                        endTimeUnixNano: '2000000000',
                                        attributes,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            })
        )
        .finish();
    const sanitized = codec.toObject(
        codec.decode(
            sanitizeComputerTelemetry(
                'traces',
                payload,
                {
                    id: 'cmp_test',
                    serverId: 'srv_test',
                    agents: [],
                },
                'production'
            )
        ),
        { longs: String }
    );
    const text = JSON.stringify(sanitized);
    expect(text).toContain('grotto.reasoning.effort');
    expect(text).toContain('12.5');
    expect(text).toContain('grotto.turn.first_send_ms');
    expect(text).toContain('grotto.tokens.input');
    expect(text).toContain('grotto.tokens.output');
    for (const name of [
        'secret',
        'first_stream',
        'last_send',
        'cache_read',
        'cache_write',
        'arbitrary',
    ]) {
        expect(text).not.toContain(name);
    }
});
