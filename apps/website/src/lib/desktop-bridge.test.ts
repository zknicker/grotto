import { describe, expect, test } from 'bun:test';
import { type GrottoDesktopBridge, resolveDesktopBridge } from './desktop-bridge.ts';

/**
 * The desktop shell and this App ship on two independent channels and are
 * routinely at different versions, so the injected global is a cross-version
 * production contract. v1.8.20 renamed it and recognised only the new name,
 * which made every older shell look like a plain browser tab: sign-in then took
 * the redirect flow, which Clerk rejects once Electron hands the URL to the
 * system browser. Both names must keep resolving.
 */
const current = { loadsApp: true } as unknown as GrottoDesktopBridge;
const legacy = { loadsApp: true } as unknown as GrottoDesktopBridge;

describe('desktop bridge discovery', () => {
    test('finds the bridge a current shell injects', () => {
        expect(resolveDesktopBridge({ grottoDesktop: current })).toBe(current);
    });

    test('finds the bridge a shell older than the Grotto rename injects', () => {
        expect(resolveDesktopBridge({ tavernDesktop: legacy })).toBe(legacy);
    });

    test('prefers the current name when a shell injects both', () => {
        expect(resolveDesktopBridge({ grottoDesktop: current, tavernDesktop: legacy })).toBe(
            current
        );
    });

    test('reports a plain browser as not the desktop app', () => {
        expect(resolveDesktopBridge({})).toBeNull();
        expect(resolveDesktopBridge(undefined)).toBeNull();
    });
});
