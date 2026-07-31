import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { AppShellDragRegion } from './app-shell.tsx';

describe('AppShell drag regions', () => {
    test('marks the transparent top strip as a native drag region', () => {
        const markup = renderToStaticMarkup(<AppShellDragRegion />);

        expect(markup).toContain('data-slot="app-shell-drag-region"');
        expect(markup).toContain('data-window-drag-region=""');
    });
});
