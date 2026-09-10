import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { HausGlyph, HausLogo } from './haus-logo.tsx';

describe('Grotto app mark', () => {
    test('uses the released ghost artwork in full and compact placements', () => {
        expect(renderToStaticMarkup(<HausLogo />)).toContain('href="/haus-app-icon.png"');
        expect(renderToStaticMarkup(<HausGlyph />)).toContain('href="/haus-app-icon.png"');
    });
});
