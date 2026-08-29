import { describe, expect, test } from 'bun:test';
import type { GrottoUpdateComputer, GrottoUpdateInput } from './grotto-update-model.ts';
import { projectGrottoUpdate } from './grotto-update-model.ts';
import { expectedComputerRestartMs } from './grotto-update-timing.ts';

const observedAt = Date.parse('2026-08-29T16:00:00.000Z');
const currentInput: GrottoUpdateInput = {
    computers: [computer({ currentVersion: '1.4.9', phase: 'idle' })],
    desktop: { currentVersion: '1.8.40', kind: 'desktop', phase: 'current' },
    observedAt,
    release: {
        components: {
            agent: '1.1.0',
            computer: '1.4.9',
            desktopApp: '1.8.40',
            ios: { buildNumber: 6, version: '1.0.5' },
            server: '1.8.38',
        },
        sourceRevision: 'a'.repeat(40),
        version: '1.9.0',
    },
    runningAgentVersion: '1.1.0',
};

describe('Grotto update projection', () => {
    test('keeps the public release version independent from component versions', () => {
        const view = projectGrottoUpdate(currentInput);

        expect(view).toMatchObject({
            headline: 'Grotto 1.9.0',
            phase: 'current',
            primaryAction: null,
            version: '1.9.0',
        });
        expect(
            view.componentFacts.map(({ label, targetVersion }) => [label, targetVersion])
        ).toEqual([
            ['Grotto App', '1.8.40'],
            ['Computer', '1.4.9'],
            ['Agent', '1.1.0'],
        ]);
    });

    test('lists every observable Computer by name and orders them deterministically', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                computer({ id: 'cmp_home', name: "Zach's MacBook Pro" }),
                computer({ id: 'cmp_office', name: 'Office' }),
            ],
            desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'available' },
        });

        expect(view.steps.map((step) => step.label)).toEqual([
            'Computer · Office',
            "Computer · Zach's MacBook Pro",
            'Grotto App',
        ]);
        expect(view.componentFacts.map((fact) => fact.label)).toEqual([
            'Grotto App',
            'Computer · Office',
            "Computer · Zach's MacBook Pro",
            'Agent',
        ]);
        expect(view).toMatchObject({ phase: 'available', primaryAction: { kind: 'start' } });
    });

    test('excludes an offline Computer because its installed version is unknown', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [computer({ health: 'offline' })],
            desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'available' },
        });

        expect(view.steps.map((step) => step.kind)).toEqual(['desktop-app']);
        expect(view.componentFacts.map((fact) => fact.label)).toEqual(['Grotto App']);
        expect(view.phase).toBe('available');
    });

    test('preserves an expected restart disconnect as active progress', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                computer({
                    health: 'offline',
                    phase: 'restarting',
                    updateUpdatedAt: new Date(observedAt - 5000).toISOString(),
                }),
            ],
        });

        expect(view).toMatchObject({ phase: 'updating', primaryAction: null });
        expect(view.steps[0]).toMatchObject({ label: 'Computer', phase: 'restarting' });
    });

    test('turns a timed-out restart into a named failure with recovery guidance', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                computer({
                    health: 'offline',
                    phase: 'restarting',
                    updateUpdatedAt: new Date(
                        observedAt - expectedComputerRestartMs - 1
                    ).toISOString(),
                }),
            ],
        });

        expect(view).toMatchObject({ phase: 'failed', primaryAction: { kind: 'retry' } });
        expect(view.componentFacts.find((fact) => fact.id === 'cmp_studio')).toMatchObject({
            detail: 'This Computer did not reconnect after installing the update.',
            label: 'Computer',
            status: 'failed',
        });
    });

    test('does not let an old completed target hide a newer release', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                computer({
                    phase: 'complete',
                    reportedTargetVersion: '1.4.8',
                }),
            ],
        });

        expect(view).toMatchObject({ phase: 'available', primaryAction: { kind: 'start' } });
        expect(view.steps[0]).toMatchObject({ phase: 'available', targetVersion: '1.4.9' });
    });

    test('keeps active work ahead of restart and restart ahead of a settled failure', () => {
        const active = projectGrottoUpdate({
            ...currentInput,
            computers: [computer({ phase: 'downloading' })],
            desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'ready' },
        });
        const settled = projectGrottoUpdate({
            ...currentInput,
            computers: [
                computer({
                    detail: 'Signature verification failed.',
                    failedPhase: 'verifying',
                    phase: 'failed',
                    reportedTargetVersion: '1.4.9',
                }),
            ],
            desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'ready' },
        });

        expect(active.phase).toBe('updating');
        expect(settled).toMatchObject({
            phase: 'restart-required',
            primaryAction: { kind: 'restart' },
        });
    });

    test('gives the web Computer actions without a desktop step', () => {
        const view = projectGrottoUpdate({ ...currentInput, desktop: { kind: 'web' } });

        expect(view.steps).toHaveLength(1);
        expect(view.componentFacts.map((fact) => fact.label)).toEqual(['Computer', 'Agent']);
    });

    test('never offers a downgrade and omits ledger targets that are absent', () => {
        const newer = projectGrottoUpdate({
            ...currentInput,
            computers: [computer({ currentVersion: '9.0.0' })],
            desktop: { currentVersion: '9.0.0', kind: 'desktop', phase: 'idle' },
        });
        const absent = projectGrottoUpdate({
            ...currentInput,
            release: {
                ...currentInput.release,
                components: {
                    ...currentInput.release.components,
                    computer: null,
                    desktopApp: null,
                },
            },
        });

        expect(newer.steps.every((step) => step.phase === 'current')).toBe(true);
        expect(absent.steps).toEqual([]);
    });
});

function computer(overrides: Partial<GrottoUpdateComputer> = {}): GrottoUpdateComputer {
    return {
        currentVersion: '1.4.8',
        health: 'healthy',
        id: 'cmp_studio',
        lastConnectedAt: '2026-08-29T15:00:00.000Z',
        name: 'Home',
        phase: 'available',
        reportedTargetVersion: '1.4.9',
        ...overrides,
    };
}
