import { expect, test } from 'bun:test';
import {
    assertReleaseSurfaceDecision,
    formatReleaseSurfaceDecision,
    resetReleaseSurfaceDecision,
} from './release-surfaces.mjs';

test('release bump starts an incomplete four-surface decision', () => {
    const decision = resetReleaseSurfaceDecision('1.2.3');
    expect(() => assertReleaseSurfaceDecision(decision, { targetVersion: '1.2.3' })).toThrow(
        'Desktop has no explicit'
    );
});

test('release check accepts and formats one explicit decision per surface', () => {
    const decision = {
        targetVersion: '1.2.3',
        surfaces: {
            appServer: { action: 'publish', version: '1.2.3' },
            computer: { action: 'publish', version: '2.0.0' },
            desktop: { action: 'unchanged', version: null },
            runtime: { action: 'unchanged', version: null },
        },
    };
    expect(assertReleaseSurfaceDecision(decision, { targetVersion: '1.2.3' }).complete).toBe(true);
    expect(formatReleaseSurfaceDecision(decision)).toContain('- Computer: Publish v2.0.0');
});
