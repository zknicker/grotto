import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { WorkspaceToolbar } from './chat-artifact-workspace-toolbar.tsx';

describe('WorkspaceToolbar', () => {
    test('exposes the hidden-files toggle state accessibly', () => {
        const hiddenOff = renderToStaticMarkup(
            <WorkspaceToolbar
                includeHidden={false}
                onIncludeHiddenChange={vi.fn()}
                onQueryChange={vi.fn()}
                onRefresh={vi.fn()}
                query=""
                refreshing={false}
            />
        );
        const hiddenOn = renderToStaticMarkup(
            <WorkspaceToolbar
                includeHidden
                onIncludeHiddenChange={vi.fn()}
                onQueryChange={vi.fn()}
                onRefresh={vi.fn()}
                query=""
                refreshing={false}
            />
        );

        expect(hiddenOff).toContain('aria-label="Show hidden files"');
        expect(hiddenOff).toContain('aria-pressed="false"');
        expect(hiddenOn).toContain('aria-label="Hide hidden files"');
        expect(hiddenOn).toContain('aria-pressed="true"');
    });
});
