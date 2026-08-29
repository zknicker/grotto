import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarded contract for where a toast lands.
 *
 * Toasts are opaque and take pointer events for their whole timeout, so the
 * bottom of a column is the one place they must not go: the chat composer sits
 * there on the end side and the sidebar's activity row on the start side, and a
 * bottom-anchored toast covered the composer and swallowed clicks on it. The
 * top band is chrome, so the region hangs below it. This pins both halves —
 * the provider's placement and the theme rule that clears the band — because
 * either one alone silently puts toasts back on top of something.
 */

const stylesDir = import.meta.dir;
const themeCss = readFileSync(join(stylesDir, 'default-theme.css'), 'utf8');
const mainTsx = readFileSync(join(stylesDir, '../main.tsx'), 'utf8');
const toastProvider = /<Toast\.Provider[^/]*\/>/u.exec(mainTsx)?.[0] ?? '';

describe('toast placement contract', () => {
    test('the region is top-anchored, never over a column footer', () => {
        expect(toastProvider).toContain('placement="top end"');
        expect(toastProvider).not.toContain('bottom');
    });

    test('every top placement clears the shell band', () => {
        const start = themeCss.indexOf('.toast-region--top-start');
        expect(start).toBeGreaterThan(-1);
        const block = themeCss.slice(start, themeCss.indexOf('}', start)).replace(/\s+/gu, ' ');

        // All three, so switching placement cannot silently lose the offset.
        expect(block).toContain('.toast-region--top,');
        expect(block).toContain('.toast-region--top-end');
        // Derived from the band rather than restated, so it tracks the band.
        expect(block).toMatch(/top: calc\(var\(--app-shell-band-height\) \+ /u);
    });

    test('toasts are narrower than HeroUI’s default', () => {
        // 460 is sized for title + description + action; Grotto's toasts are
        // mostly one-line confirmations.
        const width = /width=\{(\d+)\}/u.exec(toastProvider)?.[1];
        expect(width).toBeDefined();
        expect(Number(width)).toBeLessThan(460);
    });
});
