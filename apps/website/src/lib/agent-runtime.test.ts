import { afterEach, describe, expect, test } from 'bun:test';
import { ensureDesktopServerOrigin, isPackagedDesktopApp } from './agent-runtime.ts';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

afterEach(() => {
    if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
        return;
    }

    Reflect.deleteProperty(globalThis, 'window');
});

describe('desktop runtime origin', () => {
    test('uses the Vite proxy in dev Electron', async () => {
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                location: {
                    protocol: 'http:',
                },
                tavernDesktop: {
                    checkForUpdate: async () => undefined,
                    downloadUpdate: async () => undefined,
                    getInfo: async () => ({
                        isPackaged: false,
                        platform: process.platform,
                        version: '1.2.0',
                    }),
                    onUpdateStatus: () => () => undefined,
                    restartForUpdate: async () => undefined,
                    setTheme: async () => undefined,
                    startWindowDrag: async () => undefined,
                },
            },
        });

        expect(isPackagedDesktopApp()).toBe(false);
        expect(await ensureDesktopServerOrigin()).toBe('');
    });
});
