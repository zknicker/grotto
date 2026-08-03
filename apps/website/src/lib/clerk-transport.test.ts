import { describe, expect, it } from 'bun:test';
import { resolveClerkTransport } from './clerk-transport.ts';

describe('resolveClerkTransport', () => {
    it('uses native Clerk for Electron in development and production', () => {
        expect(resolveClerkTransport({ development: true, electron: true })).toBe('native');
        expect(resolveClerkTransport({ development: false, electron: true })).toBe('native');
    });

    it('uses browser Clerk outside Electron', () => {
        expect(resolveClerkTransport({ development: true, electron: false })).toBe('browser');
        expect(resolveClerkTransport({ development: false, electron: false })).toBe('browser');
    });
});
