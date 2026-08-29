import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { WorkspaceToolbar } from './chat-artifact-workspace-toolbar.tsx';

describe('WorkspaceToolbar', () => {
    test('is search plus one filter menu, with the active filter visible on the trigger', () => {
        const hiddenOff = renderToStaticMarkup(
            <WorkspaceToolbar
                includeHidden={false}
                onIncludeHiddenChange={vi.fn()}
                onQueryChange={vi.fn()}
                query=""
            />
        );
        const hiddenOn = renderToStaticMarkup(
            <WorkspaceToolbar
                includeHidden
                onIncludeHiddenChange={vi.fn()}
                onQueryChange={vi.fn()}
                query=""
            />
        );

        expect(hiddenOff).toContain('aria-label="Filter files"');
        // No refresh chrome: server events and stale-on-mount refetching own
        // freshness, so the toolbar offers exactly one action.
        expect(hiddenOff).not.toContain('Refresh workspace');
        // A real button treatment beside the filled search field, filtered
        // or not — the docs' PR File Review idiom.
        expect(hiddenOff).toContain('button--secondary');
        expect(hiddenOn).toContain('button--secondary');
    });
});
