import { expect, test } from 'bun:test';
import { classifyRuntimeFailure, isRetryableRuntimeFailure } from './runtime-failure.ts';

test('classifies operator-action failures as terminal', () => {
    for (const [message, kind] of [
        ['Not logged in. Run codex login.', 'authentication'],
        ['Unknown model gpt-nope', 'configuration'],
        ['Input exceeds the context window', 'input'],
    ] as const) {
        expect(classifyRuntimeFailure(new Error(message))).toBe(kind);
        expect(isRetryableRuntimeFailure(kind)).toBe(false);
    }
});

test('classifies transient failures for bounded retry', () => {
    for (const [message, kind] of [
        ['429 Too Many Requests', 'rate-limit'],
        ['WebSocket connection closed', 'transport'],
        ['Bridge startup timed out', 'timeout'],
    ] as const) {
        expect(classifyRuntimeFailure(new Error(message))).toBe(kind);
        expect(isRetryableRuntimeFailure(kind)).toBe(true);
    }
});
