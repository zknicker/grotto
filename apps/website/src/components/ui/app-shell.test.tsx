import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { AppShell, AppShellDragRegion } from './app-shell.tsx';

describe('AppShell drag regions', () => {
    test('marks the transparent top strip as a native drag region', () => {
        const markup = renderToStaticMarkup(<AppShellDragRegion />);

        expect(markup).toContain('data-slot="app-shell-drag-region"');
        expect(markup).toContain('data-window-drag-region=""');
    });
});

test('paints the transparent desktop window with the HeroUI page background', () => {
    const markup = renderToStaticMarkup(<AppShell>Content</AppShell>);

    expect(markup).toContain('bg-background');
});
