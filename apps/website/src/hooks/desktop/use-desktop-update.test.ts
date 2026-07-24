import { describe, expect, test } from 'bun:test';
import { reconcileDesktopUpdateStatus } from './use-desktop-update.ts';

describe('desktop update status', () => {
    test('keeps the target version while download progress arrives', () => {
        expect(
            reconcileDesktopUpdateStatus(
                { phase: 'downloading', progress: 0, version: '1.6.1' },
                { phase: 'downloading', progress: 0.4, version: '1.6.0' }
            )
        ).toEqual({
            phase: 'downloading',
            progress: 0.4,
            version: '1.6.1',
        });
    });

    test('accepts the downloaded update version', () => {
        expect(
            reconcileDesktopUpdateStatus(
                { phase: 'downloading', progress: 0.9, version: '1.6.1' },
                { phase: 'ready', version: '1.6.1' }
            )
        ).toEqual({ phase: 'ready', version: '1.6.1' });
    });
});
