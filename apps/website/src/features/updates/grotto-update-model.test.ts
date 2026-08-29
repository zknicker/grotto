import { describe, expect, test } from 'bun:test';
import type { GrottoUpdateInput } from './grotto-update-model.ts';
import { projectGrottoUpdate } from './grotto-update-model.ts';

const currentInput: GrottoUpdateInput = {
    computers: [
        {
            currentVersion: '1.4.9',
            id: 'cmp_studio',
            phase: 'idle',
        },
    ],
    desktop: { currentVersion: '1.8.40', kind: 'desktop', phase: 'current' },
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
    runningServerVersion: '1.8.38',
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
            ['Server', '1.8.38'],
            ['Grotto App', '1.8.40'],
            ['Computer', '1.4.9'],
            ['Agent', '1.1.0'],
            ['iOS', '1.0.5 (6)'],
        ]);
    });

    test('orders multiple Computers deterministically before the desktop App', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                {
                    currentVersion: '1.4.8',
                    id: 'cmp_studio',
                    phase: 'available',
                },
                {
                    currentVersion: '1.4.8',
                    id: 'cmp_macbook',
                    phase: 'available',
                },
            ],
            desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'available' },
        });

        expect(view.steps.map((step) => step.label)).toEqual([
            'Computer',
            'Computer',
            'Grotto App',
        ]);
        expect(view).toMatchObject({
            detail: '3 updates are ready.',
            phase: 'available',
            primaryAction: { kind: 'start', label: 'Update' },
        });
    });

    test('preserves active progress and waits for Computers before the App step', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                {
                    currentVersion: '1.4.8',
                    id: 'cmp_studio',
                    phase: 'downloading',
                    progress: 0.42,
                },
            ],
            desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'available' },
        });

        expect(view).toMatchObject({
            detail: 'Updating Computer.',
            phase: 'updating',
            primaryAction: null,
        });
        expect(view.steps).toMatchObject([
            { kind: 'computer', phase: 'downloading', progress: 0.42 },
            { kind: 'desktop-app', phase: 'available' },
        ]);
    });

    test('blocks on an offline Computer without exposing its host identity', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                {
                    currentVersion: '1.4.8',
                    id: 'cmp_studio',
                    phase: 'offline',
                },
            ],
        });

        expect(view).toMatchObject({
            detail: 'Computer must reconnect to continue.',
            phase: 'blocked',
            primaryAction: { kind: 'retry' },
        });
    });

    test('reports a failed component before a blocked component', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                {
                    currentVersion: '1.4.8',
                    detail: 'Signature verification failed.',
                    id: 'cmp_macbook',
                    phase: 'failed',
                },
                {
                    currentVersion: '1.4.8',
                    id: 'cmp_studio',
                    phase: 'offline',
                },
            ],
        });

        expect(view).toMatchObject({
            detail: 'Signature verification failed.',
            phase: 'failed',
            primaryAction: { kind: 'retry' },
        });
    });

    test('turns a downloaded desktop update into an explicit restart action', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'ready' },
        });

        expect(view).toMatchObject({
            phase: 'restart-required',
            primaryAction: { kind: 'restart', label: 'Restart' },
        });
    });

    test('gives the web honest Computer actions without a desktop step', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                {
                    currentVersion: '1.4.8',
                    id: 'cmp_studio',
                    phase: 'available',
                },
            ],
            desktop: { kind: 'web' },
        });

        expect(view.steps).toHaveLength(1);
        expect(view.steps[0]?.kind).toBe('computer');
        expect(view.componentFacts.find((fact) => fact.label === 'Grotto App')).toMatchObject({
            status: 'external',
        });
    });

    test('never offers a downgrade when an installed component is newer', () => {
        const view = projectGrottoUpdate({
            ...currentInput,
            computers: [
                {
                    currentVersion: '9.0.0',
                    id: 'cmp_studio',
                    phase: 'idle',
                },
            ],
            desktop: { currentVersion: '9.0.0', kind: 'desktop', phase: 'idle' },
        });
        expect(view.phase).toBe('current');
        expect(view.steps.every((step) => step.phase === 'current')).toBe(true);
    });

    test('omits update steps for component versions absent from the release ledger', () => {
        const view = projectGrottoUpdate({
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
        expect(view.steps).toEqual([]);
        expect(view.componentFacts.find((fact) => fact.label === 'Computer')?.targetVersion).toBe(
            null
        );
    });
});
