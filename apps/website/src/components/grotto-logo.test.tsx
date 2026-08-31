import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrottoGlyph, GrottoLogo } from './grotto-logo.tsx';

describe('Grotto app mark', () => {
    test('uses the released ghost artwork in full and compact placements', () => {
        expect(renderToStaticMarkup(<GrottoLogo />)).toContain('href="/grotto-app-icon.png"');
        expect(renderToStaticMarkup(<GrottoGlyph />)).toContain('href="/grotto-app-icon.png"');
    });
});
