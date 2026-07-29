import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
    spawn: spawnMock,
}));

describe('Runtime update', () => {
    beforeEach(() => {
        spawnMock.mockReset();
        vi.resetModules();
    });

    it('stages the Runtime update without restarting the service', async () => {
        const child = createChildProcess();
        spawnMock.mockReturnValue(child);
        const update = await import('./update.ts');
        const events = await import('./runtime-events.ts');
        const phases: string[] = [];
        const unsubscribe = events.subscribeToRuntimeEvents((event) => phases.push(event.type));

        const status = update.startRuntimeUpdate({ targetVersion: '1.2.3' });

        expect(status).toMatchObject({
            phase: 'installing',
            targetVersion: '1.2.3',
        });
        expect(spawnMock).toHaveBeenCalledWith(
            'sh',
            [
                '-lc',
                expect.stringMatching(/brew update.*brew upgrade grotto-runtime.*engine install/),
            ],
            expect.objectContaining({
                stdio: 'ignore',
            })
        );

        child.emit('exit', 0);

        expect(update.getRuntimeUpdateStatus()).toMatchObject({
            phase: 'staged',
            targetVersion: '1.2.3',
        });
        expect(phases).toEqual(['runtime.update', 'runtime.update']);
        unsubscribe();
    });

    it('restarts Runtime only through the explicit restart step', async () => {
        const child = createChildProcess();
        spawnMock.mockReturnValue(child);
        const update = await import('./update.ts');

        const status = update.restartRuntimeForUpdate();

        expect(status.phase).toBe('restarting');
        expect(spawnMock).toHaveBeenCalledWith(
            'sh',
            ['-lc', 'brew services restart grotto-runtime'],
            expect.objectContaining({
                detached: true,
                stdio: 'ignore',
            })
        );
        expect(child.unref).toHaveBeenCalled();
    });
});

function createChildProcess() {
    return Object.assign(new EventEmitter(), {
        unref: vi.fn(),
    });
}
