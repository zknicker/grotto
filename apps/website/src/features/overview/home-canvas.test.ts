import { describe, expect, test } from 'bun:test';
import { agentAvatarAliases, buildAvatarSpriteCss, parseCanvasHeight } from './home-canvas.tsx';

describe('parseCanvasHeight', () => {
    test('reads the height meta tag', () => {
        expect(
            parseCanvasHeight('<head><meta name="tavern-canvas-height" content="320"></head>')
        ).toBe(320);
    });

    test('clamps to the allowed range', () => {
        expect(parseCanvasHeight('<meta name="tavern-canvas-height" content="9999">')).toBe(720);
        expect(parseCanvasHeight('<meta name="tavern-canvas-height" content="60">')).toBe(120);
    });

    test('defaults when the meta tag is absent or malformed', () => {
        expect(parseCanvasHeight('<html><body>hi</body></html>')).toBe(200);
        expect(parseCanvasHeight('<meta name="tavern-canvas-height" content="tall">')).toBe(200);
    });
});

describe('agentAvatarAliases', () => {
    test('covers exact, slug, and collapsed forms', () => {
        expect(agentAvatarAliases('Otto')).toEqual(['otto']);
        expect(agentAvatarAliases("  Wren's  Twin ")).toEqual([
            "wren's twin",
            'wren-s-twin',
            'wrenstwin',
        ]);
    });
});

describe('buildAvatarSpriteCss', () => {
    test('emits a case-insensitive, fully-styled rule per alias', () => {
        const css = buildAvatarSpriteCss([
            {
                aliases: agentAvatarAliases("Wren's Twin"),
                url: '/api/avatars/avt_0123456789abcdef',
            },
        ]);

        expect(css).toContain('.tavern-avatar[data-agent="wren\'s twin" i]');
        expect(css).toContain('.tavern-avatar[data-agent="wren-s-twin" i]');
        expect(css).toContain('.tavern-avatar[data-agent="wrenstwin" i]');
        // Every rule carries its own sizing, so unknown agents collapse to
        // nothing instead of an empty gap.
        expect(css).not.toContain('.tavern-avatar{');
        expect(css).toContain('display:inline-block;width:1.15em');
        expect(css).toContain('url("/api/avatars/avt_0123456789abcdef")');
    });

    test('escapes quotes so a hostile name cannot break out of the rule', () => {
        const css = buildAvatarSpriteCss([{ aliases: ['a"b'], url: 'https://x/a"b.png' }]);

        expect(css).toContain('[data-agent="a\\"b" i]');
        expect(css).toContain('url("https://x/a\\"b.png")');
    });

    test('returns nothing without sprites', () => {
        expect(buildAvatarSpriteCss([])).toBe('');
    });
});
