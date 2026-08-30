import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    OfflineComputersTooltipContent,
    UpdateTooltipContent,
} from './grotto-status-tooltip-content.tsx';
import { GrottoUpdateFooter } from './grotto-update-footer.tsx';
import type {
    GrottoReleaseSnapshot,
    GrottoUpdateComputer,
    GrottoUpdateDesktop,
    GrottoUpdateInput,
} from './grotto-update-model.ts';
import { projectGrottoUpdate } from './grotto-update-model.ts';
import { GrottoVersionBreakdown } from './grotto-version-breakdown.tsx';
import { GrottoVersionSummary } from './grotto-version-summary.tsx';
import type { OfflineComputerNotice } from './use-offline-computers.ts';

const release: GrottoReleaseSnapshot = {
    components: {
        agent: '1.1.0',
        computer: '1.4.9',
        desktopApp: '1.8.40',
        ios: { buildNumber: 6, version: '1.0.5' },
        server: '1.8.38',
    },
    sourceRevision: 'a'.repeat(40),
    version: '1.9.0',
};

const currentDesktop: GrottoUpdateDesktop = {
    currentVersion: '1.8.40',
    kind: 'desktop',
    phase: 'current',
};

const currentView = updateView({
    computers: [computer({ currentVersion: '1.4.9', phase: 'idle' })],
});
const oneComputerUpdateView = updateView({ computers: [computer({})] });
const multipleUpdatesView = updateView({
    computers: [
        computer({ id: 'cmp_home', name: "Zach's MacBook Pro" }),
        computer({ id: 'cmp_office', name: 'Office' }),
    ],
    desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'available' },
});
const downloadingView = updateView({
    computers: [computer({ phase: 'downloading', progress: 0.42 })],
});
const restartRequiredView = updateView({
    desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'ready' },
});
const offlineComputers: OfflineComputerNotice[] = [
    {
        id: 'cmp_offline',
        lastConnectedAt: '2026-08-29T15:00:00.000Z',
        name: 'Home',
    },
];

describe('Grotto update surfaces', () => {
    test('keeps the compact update control hidden when Grotto is current', () => {
        const html = renderToStaticMarkup(<GrottoUpdateFooter view={currentView} />);

        expect(html).toBe('');
    });

    test('uses one compact update button with an anchored contrast tooltip', () => {
        const html = renderToStaticMarkup(<GrottoUpdateFooter view={multipleUpdatesView} />);
        const tooltip = renderToStaticMarkup(<UpdateTooltipContent view={multipleUpdatesView} />);

        expect(html).toContain('Update Grotto to 1.9.0');
        expect(html.match(/<button/gu)).toHaveLength(1);
        expect(html).toContain('role="presentation" tabindex="-1"');
        expect(html).not.toContain('cursor-hover-card');
        expect(tooltip).toContain('Click to update');
        expect(tooltip).not.toContain('Update available');
    });

    test('shows only surfaces that still need attention and always names Computers', () => {
        const tooltip = renderToStaticMarkup(<UpdateTooltipContent view={oneComputerUpdateView} />);

        expect(tooltip).toContain('Computer · Zach&#x27;s MacBook Pro');
        expect(tooltip).not.toContain('Grotto App');
        expect(tooltip).not.toContain('up to date');
    });

    test('keeps a busy update control non-actionable without removing its tooltip trigger', () => {
        const html = renderToStaticMarkup(<GrottoUpdateFooter view={downloadingView} />);
        const tooltip = renderToStaticMarkup(<UpdateTooltipContent view={downloadingView} />);

        expect(html).toContain('aria-disabled="true"');
        expect(html).toContain('role="presentation" tabindex="-1"');
        expect(tooltip).toContain('Updating');
        expect(tooltip).toContain('Computer · Zach&#x27;s MacBook Pro');
        expect(tooltip).toContain('Downloading Grotto Computer');
        expect(tooltip).toContain('aria-valuenow="42"');
    });

    test('shows desktop App download progress in the update tooltip', () => {
        const tooltip = renderToStaticMarkup(
            <UpdateTooltipContent
                view={updateView({
                    desktop: {
                        currentVersion: '1.8.39',
                        kind: 'desktop',
                        phase: 'downloading',
                        progress: 0.65,
                    },
                })}
            />
        );

        expect(tooltip).toContain('Grotto App');
        expect(tooltip).toContain('Downloading Grotto App');
        expect(tooltip).toContain('aria-valuenow="65"');
        expect(tooltip).toContain('1.8.39 → 1.8.40');
    });

    test('renders only release surfaces with dense current and target versions', () => {
        const html = renderToStaticMarkup(
            <GrottoVersionBreakdown facts={multipleUpdatesView.componentFacts} />
        );

        expect(html).toContain('Grotto App');
        expect(html).toContain('Computer · Zach&#x27;s MacBook Pro');
        expect(html).toContain('Computer · Office');
        expect(html).not.toContain('>MacBook</dt>');
        expect(html).not.toContain('>Agent</dt>');
        expect(html).not.toContain('Server');
        expect(html).not.toContain('iOS');
        expect(html).toContain('1.8.39 → 1.8.40 · update');
        expect(html.match(/1.4.8 → 1.4.9 · update/gu)).toHaveLength(2);
        expect(html).toContain('text-danger');
        expect(html).not.toContain('Server');
    });

    test('marks manageable surfaces green when they are current', () => {
        const html = renderToStaticMarkup(
            <GrottoVersionBreakdown facts={currentView.componentFacts} />
        );

        expect(html).toContain('1.8.40 · up to date');
        expect(html).toContain('1.4.9 · up to date');
        expect(html).toContain('text-success');
    });

    test('prominently renders only the product version in Settings', () => {
        const html = renderToStaticMarkup(<GrottoVersionSummary view={restartRequiredView} />);

        expect(html).toContain('Grotto 1.9.0');
        expect(html).toContain('Component updates are managed from the sidebar.');
        expect(html).not.toContain('Restart to finish');
    });

    test('lets the HeroUI footer own the status control inset', () => {
        const html = renderToStaticMarkup(<GrottoUpdateFooter view={oneComputerUpdateView} />);

        expect(html).toContain('class="flex w-full items-center gap-2"');
        expect(html).not.toContain('items-center gap-2 px-2');
    });

    test('renders offline Computers in a separate warning control', () => {
        const html = renderToStaticMarkup(
            <GrottoUpdateFooter offlineComputers={offlineComputers} view={currentView} />
        );
        const tooltip = renderToStaticMarkup(
            <OfflineComputersTooltipContent computers={offlineComputers} />
        );

        expect(html).toContain('1 Computer is offline');
        expect(tooltip).toContain('Computer offline');
        expect(tooltip).toContain('Last connected:');
        expect(tooltip).toContain('Home');
        expect(html).not.toContain('Download');
    });
});

function updateView(overrides: Partial<GrottoUpdateInput> = {}) {
    return projectGrottoUpdate({
        computers: overrides.computers ?? [computer({ currentVersion: '1.4.9', phase: 'idle' })],
        desktop: overrides.desktop ?? currentDesktop,
        release: overrides.release ?? release,
    });
}

function computer(overrides: Partial<GrottoUpdateComputer>): GrottoUpdateComputer {
    return {
        currentVersion: '1.4.8',
        health: 'healthy',
        id: 'cmp_home',
        lastConnectedAt: '2026-08-29T15:00:00.000Z',
        name: "Zach's MacBook Pro",
        phase: 'available',
        reportedTargetVersion: '1.4.9',
        ...overrides,
    };
}
