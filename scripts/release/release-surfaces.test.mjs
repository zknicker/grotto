import { expect, test } from 'bun:test';
import {
    assertReleaseSurfaceDecision,
    formatReleaseSurfaceDecision,
    releasePublishesSurface,
    resetReleaseSurfaceDecision,
} from './release-surfaces.mjs';

test('release bump starts an incomplete four-surface decision', () => {
    const decision = resetReleaseSurfaceDecision('1.2.3');
    expect(() => assertReleaseSurfaceDecision(decision, { targetVersion: '1.2.3' })).toThrow(
        'App has no explicit'
    );
});

test('release check accepts and formats one explicit decision per surface', () => {
    const decision = {
        targetVersion: '1.2.3',
        surfaces: {
            server: { action: 'publish', version: '1.2.3' },
            computer: { action: 'publish', version: '2.0.0' },
            app: { action: 'unchanged', version: null },
            runtime: { action: 'unchanged', version: null },
        },
    };
    expect(assertReleaseSurfaceDecision(decision, { targetVersion: '1.2.3' }).complete).toBe(true);
    const formatted = formatReleaseSurfaceDecision(decision);
    expect(formatted).toContain('- Server: Publish v1.2.3');
    expect(formatted).toContain('- App: Unchanged');
    expect(formatted).toContain('- Computer: Publish v2.0.0');
    expect(releasePublishesSurface(decision, 'server')).toBe(true);
    expect(releasePublishesSurface(decision, 'app')).toBe(false);
});

test('Computer-only repairs explicitly leave every other surface unchanged', () => {
    const decision = {
        targetVersion: null,
        surfaces: {
            server: { action: 'unchanged', version: null },
            computer: { action: 'publish', version: '2.0.1' },
            app: { action: 'unchanged', version: null },
            runtime: { action: 'unchanged', version: null },
        },
    };
    expect(assertReleaseSurfaceDecision(decision, { requireDecision: true }).complete).toBe(true);
    expect(() =>
        assertReleaseSurfaceDecision(decision, {
            requireDecision: true,
            targetVersion: '1.2.3',
        })
    ).toThrow('cannot satisfy a Server release');
});
