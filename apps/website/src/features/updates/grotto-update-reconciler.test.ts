import { describe, expect, test } from 'bun:test';
import type {
    ComputerUpdateStep,
    DesktopUpdateStep,
    GrottoUpdateStep,
    GrottoUpdateView,
} from './grotto-update-model.ts';
import {
    createGrottoUpdateController,
    nextGrottoUpdateAction,
    runGrottoUpdateSequence,
} from './grotto-update-reconciler.ts';

describe('Grotto update reconciler', () => {
    test('updates Computers in order before downloading and restarting the desktop App', async () => {
        const states = [
            view([
                computer('alpha', 'available'),
                computer('beta', 'available'),
                desktop('pending'),
            ]),
            view([computer('alpha', 'current'), computer('beta', 'available'), desktop('pending')]),
            view([computer('alpha', 'current'), computer('beta', 'current'), desktop('pending')]),
            view([
                computer('alpha', 'current'),
                computer('beta', 'current'),
                desktop('restart-required'),
            ]),
        ];
        let stateIndex = 0;
        const calls: string[] = [];

        const result = await runGrottoUpdateSequence({
            downloadDesktop: async (version) => {
                calls.push(`download:${version}`);
            },
            readView: () => states[stateIndex] ?? states.at(-1)!,
            restartDesktop: async (version) => {
                calls.push(`restart:${version}`);
            },
            updateComputer: async ({ computerId, targetVersion }) => {
                calls.push(`computer:${computerId}:${targetVersion}`);
            },
            waitForChange: async (step) => {
                calls.push(`wait:${step.id}`);
                stateIndex += 1;
            },
        });

        expect(result).toEqual({ kind: 'restart-required', targetVersion: '1.8.40' });
        expect(calls).toEqual([
            'computer:alpha:1.4.9',
            'wait:alpha',
            'computer:beta:1.4.9',
            'wait:beta',
            'download:1.8.40',
            'wait:desktop-app',
        ]);
    });

    test('restarts only when a run begins from the explicit restart step', async () => {
        const calls: string[] = [];
        const result = await runGrottoUpdateSequence({
            downloadDesktop: async () => undefined,
            readView: () => view([desktop('restart-required')]),
            restartDesktop: async (version) => {
                calls.push(`restart:${version}`);
            },
            updateComputer: async () => undefined,
            waitForChange: async () => undefined,
        });

        expect(result).toEqual({ kind: 'restarting', targetVersion: '1.8.40' });
        expect(calls).toEqual(['restart:1.8.40']);
    });

    test('waits for an active Computer and never advances to a later step early', async () => {
        expect(
            nextGrottoUpdateAction(
                view([
                    computer('alpha', 'restarting'),
                    computer('beta', 'available'),
                    desktop('pending'),
                ])
            )
        ).toMatchObject({ kind: 'wait', step: { id: 'alpha' } });
    });

    test('stops on an offline Computer without touching later Computers or desktop', async () => {
        const calls: string[] = [];
        const result = await runGrottoUpdateSequence({
            downloadDesktop: async () => {
                calls.push('desktop');
            },
            readView: () =>
                view([
                    computer('alpha', 'offline'),
                    computer('beta', 'available'),
                    desktop('pending'),
                ]),
            restartDesktop: async () => {
                calls.push('restart');
            },
            updateComputer: async ({ computerId }) => {
                calls.push(computerId);
            },
            waitForChange: async () => {
                calls.push('wait');
            },
        });

        expect(result).toEqual({ computerId: 'alpha', kind: 'blocked' });
        expect(calls).toEqual([]);
    });

    test('retries a failed first step before considering later work', () => {
        expect(
            nextGrottoUpdateAction(
                view([
                    computer('alpha', 'failed'),
                    computer('beta', 'available'),
                    desktop('pending'),
                ])
            )
        ).toEqual({
            computerId: 'alpha',
            kind: 'update-computer',
            retry: true,
            targetVersion: '1.4.9',
        });
    });

    test('returns a new failure without retrying it inside the same run', async () => {
        const states = [
            view([computer('alpha', 'available')]),
            view([computer('alpha', 'failed')]),
        ];
        let stateIndex = 0;
        let attempts = 0;

        const result = await runGrottoUpdateSequence({
            downloadDesktop: async () => undefined,
            readView: () => states[stateIndex] ?? states[1],
            restartDesktop: async () => undefined,
            updateComputer: async () => {
                attempts += 1;
            },
            waitForChange: async () => {
                stateIndex = 1;
            },
        });

        expect(result).toEqual({ kind: 'failed', stepId: 'alpha' });
        expect(attempts).toBe(1);
    });

    test('completes after Computers in a browser view with no desktop step', async () => {
        const result = await runGrottoUpdateSequence({
            downloadDesktop: async () => {
                throw new Error('browser cannot update a desktop App');
            },
            readView: () => view([computer('alpha', 'current')]),
            restartDesktop: async () => {
                throw new Error('browser cannot restart a desktop App');
            },
            updateComputer: async () => {
                throw new Error('current Computer must not update');
            },
            waitForChange: async () => {
                throw new Error('complete update must not wait');
            },
        });

        expect(result).toEqual({ kind: 'complete' });
    });

    test('coalesces concurrent controller runs into one operation sequence', async () => {
        let releaseDownload: () => void = () => undefined;
        let downloads = 0;
        let state = view([desktop('pending')]);
        const controller = createGrottoUpdateController({
            downloadDesktop: async () => {
                downloads += 1;
                await new Promise<void>((resolve) => {
                    releaseDownload = resolve;
                });
            },
            readView: () => state,
            restartDesktop: async () => undefined,
            updateComputer: async () => undefined,
            waitForChange: async () => {
                state = view([desktop('restart-required')]);
            },
        });

        const first = controller.run();
        const second = controller.run();
        await Promise.resolve();
        expect(downloads).toBe(1);
        expect(second).toBe(first);

        releaseDownload();
        await expect(first).resolves.toEqual({
            kind: 'restart-required',
            targetVersion: '1.8.40',
        });
    });
});

function computer(id: string, phase: ComputerUpdateStep['phase']): ComputerUpdateStep {
    return {
        currentVersion: phase === 'current' ? '1.4.9' : '1.4.8',
        detail: null,
        id,
        kind: 'computer',
        label: id,
        phase,
        progress: null,
        targetVersion: '1.4.9',
    };
}

function desktop(phase: DesktopUpdateStep['phase']): DesktopUpdateStep {
    return {
        currentVersion: phase === 'current' ? '1.8.40' : '1.8.38',
        detail: null,
        id: 'desktop-app',
        kind: 'desktop-app',
        label: 'Grotto App',
        phase,
        progress: null,
        targetVersion: '1.8.40',
    };
}

function view(steps: GrottoUpdateStep[]): GrottoUpdateView {
    return {
        componentFacts: [],
        detail: '',
        headline: '',
        phase: steps.every((step) => step.phase === 'current') ? 'current' : 'available',
        primaryAction: null,
        steps,
        version: '1.9.0',
    };
}
