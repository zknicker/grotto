import { expect, test } from 'bun:test';
import { createQueryReconnectHandler } from './query-reconnect-recovery.ts';

test('reconciles durable queries after reconnecting without refetching on initial connect', () => {
    const states: string[] = [];
    let reconciliations = 0;
    const handleConnectionState = createQueryReconnectHandler({
        onReconnect: () => {
            reconciliations += 1;
        },
        onStateChange: (state) => states.push(state),
    });

    handleConnectionState('connected');
    expect(reconciliations).toBe(0);

    handleConnectionState('reconnecting');
    handleConnectionState('connected');

    expect(states).toEqual(['connected', 'reconnecting', 'connected']);
    expect(reconciliations).toBe(1);
});

test('preserves reconnect recovery across an authenticated connection replacement', () => {
    let reconciliations = 0;
    const handleConnectionState = createQueryReconnectHandler({
        onReconnect: () => {
            reconciliations += 1;
        },
        onStateChange: () => undefined,
    });

    handleConnectionState('connected');
    handleConnectionState('connecting');
    handleConnectionState('connected');

    expect(reconciliations).toBe(1);
});
