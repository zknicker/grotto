import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    OfflineComputersTooltipContent,
    UpdateTooltipContent,
} from './grotto-status-tooltip-content.tsx';
import { GrottoUpdateFooter } from './grotto-update-footer.tsx';
import type { GrottoUpdateView } from './grotto-update-model.ts';
import { GrottoVersionBreakdown } from './grotto-version-breakdown.tsx';
import { GrottoVersionSummary } from './grotto-version-summary.tsx';
import { updatePreviewScenes } from './update-preview-scenes.ts';

const currentView: GrottoUpdateView = {
    componentFacts: [
        {
            currentVersion: '1.8.40',
            detail: null,
            id: 'desktop-app',
            kind: 'desktop-app',
            label: 'Grotto App',
            remedy: null,
            status: 'current',
            targetVersion: '1.8.40',
        },
        {
            currentVersion: '1.4.9',
            detail: null,
            id: 'cmp_studio',
            kind: 'computer',
            label: 'Computer',
            remedy: null,
            status: 'current',
            targetVersion: '1.4.9',
        },
        {
            currentVersion: '1.1.0',
            detail: null,
            id: 'agent',
            kind: 'agent',
            label: 'Agent',
            remedy: null,
            status: 'current',
            targetVersion: '1.1.0',
        },
    ],
    detail: 'Everything in this release is current.',
    headline: 'Grotto 1.9.0',
    phase: 'current',
    primaryAction: null,
    steps: [],
    version: '1.9.0',
};

describe('Grotto update surfaces', () => {
    test('keeps the compact update control hidden when Grotto is current', () => {
        const html = renderToStaticMarkup(<GrottoUpdateFooter view={currentView} />);

        expect(html).toBe('');
    });

    test('uses one compact update button with an anchored contrast tooltip', () => {
        const view = updatePreviewScenes.find((scene) => scene.id === 'multiple-updates')?.view;
        if (!view) {
            throw new Error('Missing multiple-updates preview.');
        }
        const html = renderToStaticMarkup(<GrottoUpdateFooter view={view} />);
        const tooltip = renderToStaticMarkup(<UpdateTooltipContent view={view} />);

        expect(html).toContain('Update Grotto to 1.9.0');
        expect(html.match(/<button/gu)).toHaveLength(1);
        expect(html).toContain('role="presentation" tabindex="-1"');
        expect(html).not.toContain('cursor-hover-card');
        expect(tooltip).toContain('Click to update');
        expect(tooltip).not.toContain('Update available');
    });

    test('keeps a busy update control non-actionable without removing its tooltip trigger', () => {
        const view = updatePreviewScenes.find((scene) => scene.id === 'computer-downloading')?.view;
        if (!view) {
            throw new Error('Missing computer-downloading preview.');
        }
        const html = renderToStaticMarkup(<GrottoUpdateFooter view={view} />);
        const tooltip = renderToStaticMarkup(<UpdateTooltipContent view={view} />);

        expect(html).toContain('aria-disabled="true"');
        expect(html).toContain('role="presentation" tabindex="-1"');
        expect(tooltip).toContain('Updating');
        expect(tooltip).toContain('Computer');
    });

    test('renders only release surfaces with dense current and target versions', () => {
        const view = updatePreviewScenes.find((scene) => scene.id === 'multiple-updates')?.view;
        if (!view) {
            throw new Error('Missing multiple-updates preview.');
        }
        const html = renderToStaticMarkup(<GrottoVersionBreakdown facts={view.componentFacts} />);

        expect(html).toContain('Grotto App');
        expect(html).toContain('Computer · Home');
        expect(html).toContain('Computer · Office');
        expect(html).not.toContain('MacBook');
        expect(html).toContain('Agent');
        expect(html).not.toContain('Server');
        expect(html).not.toContain('iOS');
        expect(html).toContain('1.8.39 → 1.8.40 · update');
        expect(html.match(/1.4.8 → 1.4.9 · update/gu)).toHaveLength(2);
        expect(html).toContain('1.1.0 · up to date');
        expect(html).toContain('text-danger');
        expect(html).toContain('text-success');
        expect(html).not.toContain('Server');
    });

    test('marks manageable surfaces green when they are current', () => {
        const html = renderToStaticMarkup(
            <GrottoVersionBreakdown facts={currentView.componentFacts} />
        );

        expect(html).toContain('1.8.40 · up to date');
        expect(html).toContain('1.4.9 · up to date');
        expect(html).toContain('1.1.0 · up to date');
        expect(html).toContain('text-success');
    });

    test('prominently renders only the product version in Settings', () => {
        const view = updatePreviewScenes.find((scene) => scene.id === 'restart-required')?.view;
        if (!view) {
            throw new Error('Missing restart-required preview.');
        }
        const html = renderToStaticMarkup(<GrottoVersionSummary view={view} />);

        expect(html).toContain('Grotto 1.9.0');
        expect(html).toContain('Component updates are managed from the sidebar.');
        expect(html).not.toContain('Restart to finish');
    });

    test('keeps every requested debug state addressable by a stable scene id', () => {
        expect(updatePreviewScenes.map((scene) => scene.id)).toEqual([
            'current-desktop',
            'current-web',
            'multiple-updates',
            'computer-downloading',
            'waiting-for-agents',
            'computer-restarting',
            'desktop-downloading',
            'restart-required',
            'computer-offline',
            'computer-failed',
            'desktop-failed',
            'independent-versions',
        ]);
    });

    test('renders offline Computers in a separate warning control', () => {
        const scene = updatePreviewScenes.find((candidate) => candidate.id === 'computer-offline');
        if (!scene) {
            throw new Error('Missing computer-offline preview.');
        }
        const html = renderToStaticMarkup(
            <GrottoUpdateFooter offlineComputers={scene.offlineComputers} view={scene.view} />
        );
        const tooltip = renderToStaticMarkup(
            <OfflineComputersTooltipContent computers={scene.offlineComputers} />
        );

        expect(html).toContain('1 Computer is offline');
        expect(tooltip).toContain('Computer offline');
        expect(tooltip).toContain('Last connected:');
        expect(tooltip).toContain('Home');
        expect(html).not.toContain('Download');
    });
});
