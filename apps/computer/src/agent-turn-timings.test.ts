import { expect, test } from 'bun:test';
import { AgentTurnTimings } from './agent-turn-timings.ts';

test('distinguishes first events, repeated sends, and trailing work on a monotonic clock', async () => {
    let now = 100;
    const timings = new AgentTurnTimings(() => now);
    timings.setReasoningEffort('medium');
    now = 110;
    timings.mark('harness_ready');
    const session = {};
    expect(
        await timings.measure('session_create', async () => {
            now = 130;
            return session;
        })
    ).toBe(session);
    now = 140;
    timings.mark('first_stream');
    now = 150;
    timings.mark('first_tool');
    now = 160;
    timings.mark('first_tool');
    timings.recordSend();
    now = 200;
    timings.recordSend();
    now = 250;
    expect(timings.snapshot()).toEqual({
        'grotto.reasoning.effort': 'medium',
        'grotto.turn.harness_ready_ms': 10,
        'grotto.turn.session_create_ms': 20,
        'grotto.turn.first_stream_ms': 40,
        'grotto.turn.first_tool_ms': 50,
        'grotto.turn.first_send_ms': 60,
        'grotto.turn.last_send_ms': 100,
        'grotto.turn.after_last_send_ms': 50,
    });
});

test('retains failed phase duration without inventing sends or replacing the error', async () => {
    let now = 0;
    const timings = new AgentTurnTimings(() => now);
    const failure = new Error('session rejected');
    await expect(
        timings.measure('session_create', async () => {
            now = 5;
            throw failure;
        })
    ).rejects.toBe(failure);
    expect(timings.snapshot()).toEqual({ 'grotto.turn.session_create_ms': 5 });
});
