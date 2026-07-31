import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArtifactTabStrip } from './chat-artifact-tab-strip.tsx';
import { getArtifactPanelTargetKey, type TavernResourceTarget } from './tavern-resource-link.ts';

const targets: TavernResourceTarget[] = [
    { agentId: 'agent-1', kind: 'workspaceDirectory', path: '' },
    { agentId: 'agent-1', kind: 'workspaceFile', path: 'notes/NOTES.md' },
];

function renderStrip(activeKey: null | string) {
    return renderToStaticMarkup(
        <ArtifactTabStrip
            activeKey={activeKey}
            onCloseTarget={() => undefined}
            onSelectTarget={() => undefined}
            targets={targets}
        />
    );
}

test('artifact tabs expose selection state and a labelled close control per tab', () => {
    const markup = renderStrip(getArtifactPanelTargetKey(targets[1]));

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-label="Open artifacts"');
    // Two tabs: the workspace tab and the open file, the latter selected.
    expect(markup.match(/role="tab"/gu)).toHaveLength(2);
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-label="Close Workspace"');
    expect(markup).toContain('aria-label="Close NOTES.md"');
    // Full path stays available on hover for disambiguating same-named files.
    expect(markup).toContain('title="notes/NOTES.md"');
});

test('no artifact tab reads as selected when the pane has no active target', () => {
    expect(renderStrip(null)).not.toContain('aria-selected="true"');
});
