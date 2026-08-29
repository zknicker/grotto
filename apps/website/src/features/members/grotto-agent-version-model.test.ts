import { expect, test } from 'bun:test';
import { grottoAgentVersionView } from './grotto-agent-version-model.ts';

test('presents the applied Grotto Agent version when current', () => {
    expect(
        grottoAgentVersionView({
            appliedAt: '2026-08-28T12:00:00.000Z',
            appliedVersion: '1.2.3',
            currentVersion: '1.2.3',
            status: 'current',
        })
    ).toEqual({ color: 'accent', detail: 'Up to date', version: 'v1.2.3' });
});

test('presents the version transition and failed update', () => {
    expect(
        grottoAgentVersionView({
            appliedAt: '2026-08-27T12:00:00.000Z',
            appliedVersion: '1.2.2',
            currentVersion: '1.2.3',
            status: 'failed',
        })
    ).toEqual({ color: 'danger', detail: 'Update failed', version: 'v1.2.2 → v1.2.3' });
});

test('presents a first application as pending', () => {
    expect(
        grottoAgentVersionView({
            appliedAt: null,
            appliedVersion: null,
            currentVersion: '1.2.3',
            status: 'pending',
        })
    ).toEqual({
        color: 'warning',
        detail: 'Updates on next turn',
        version: 'Not applied → v1.2.3',
    });
});

test('presents an existing version waiting for its next turn', () => {
    expect(
        grottoAgentVersionView({
            appliedAt: '2026-08-27T12:00:00.000Z',
            appliedVersion: '1.2.2',
            currentVersion: '1.2.3',
            status: 'pending',
        })
    ).toEqual({
        color: 'warning',
        detail: 'Updates on next turn',
        version: 'v1.2.2 → v1.2.3',
    });
});

test('presents a failed first application without inventing an applied version', () => {
    expect(
        grottoAgentVersionView({
            appliedAt: null,
            appliedVersion: null,
            currentVersion: '1.2.3',
            status: 'failed',
        })
    ).toEqual({
        color: 'danger',
        detail: 'Update failed',
        version: 'Not applied → v1.2.3',
    });
});
