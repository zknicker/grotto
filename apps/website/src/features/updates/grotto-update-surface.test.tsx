import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrottoUpdateFooter } from './grotto-update-footer.tsx';
import type { GrottoUpdateView } from './grotto-update-model.ts';
import { GrottoVersionBreakdown } from './grotto-version-breakdown.tsx';
import { GrottoVersionSummary } from './grotto-version-summary.tsx';
import { updatePreviewScenes } from './update-preview-scenes.ts';

const currentView: GrottoUpdateView = {
    componentFacts: [
        {
            currentVersion: '1.8.40',
            label: 'Grotto App',
            status: 'current',
            targetVersion: '1.8.40',
        },
        {
            currentVersion: '1.4.9',
            label: 'Computer',
            status: 'current',
            targetVersion: '1.4.9',
        },
        {
            currentVersion: '1.1.0',
            label: 'Agent',
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

    test('uses one compact update button whose hover card owns the detail', () => {
        const view = updatePreviewScenes.find((scene) => scene.id === 'multiple-updates')?.view;
        if (!view) {
            throw new Error('Missing multiple-updates preview.');
        }
        const html = renderToStaticMarkup(<GrottoUpdateFooter view={view} />);

        expect(html).toContain('Update Grotto to 1.9.0');
        expect(html).toContain('hover-card__trigger');
        expect(html).not.toContain('Update available');
    });

    test('renders only release surfaces with dense current and target versions', () => {
        const view = updatePreviewScenes.find((scene) => scene.id === 'multiple-updates')?.view;
        if (!view) {
            throw new Error('Missing multiple-updates preview.');
        }
        const html = renderToStaticMarkup(<GrottoVersionBreakdown facts={view.componentFacts} />);

        expect(html).toContain('Grotto App');
        expect(html).toContain('Computer');
        expect(html).toContain('Agent');
        expect(html).not.toContain('Server');
        expect(html).not.toContain('iOS');
        expect(html).toContain('1.8.39 → 1.8.40 · update');
        expect(html).toContain('1.4.8 → 1.4.9 · update');
        expect(html).toContain('1.1.0 · up to date');
        expect(html).toContain('text-danger');
        expect(html).toContain('text-success');
        expect(html).not.toContain('MacBook');
        expect(html).not.toContain('Studio Mac');
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
});
