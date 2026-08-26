import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesktopUpdateStatus } from '../../hooks/desktop/use-desktop-update.ts';
import { DesktopUpdateStatusControl } from './desktop-update-status.tsx';

describe('desktop update footer', () => {
    test('renders the available, progress, restart, and failure actions', () => {
        expect(renderStatus({ phase: 'available', version: '1.9.0' })).toContain(
            'Update available'
        );
        expect(renderStatus({ phase: 'downloading', progress: 0.42, version: '1.9.0' })).toContain(
            'Updating · 42%'
        );
        expect(renderStatus({ phase: 'ready', version: '1.9.0' })).toContain('Restart to update');
        expect(renderStatus({ message: 'No network', phase: 'error' })).toContain(
            'Update failed. Retry'
        );
    });

    test('keeps non-actionable background states out of the sidebar', () => {
        expect(renderStatus({ phase: 'current' })).toBe('');
        expect(renderStatus({ phase: 'checking' })).toBe('');
        expect(renderStatus({ phase: 'unsupported' })).toBe('');
    });

    test('renders active updates as full-opacity icon statuses instead of disabled buttons', () => {
        const downloading = renderStatus({
            phase: 'downloading',
            progress: 0.42,
            version: '1.9.0',
        });
        const restarting = renderStatus({ phase: 'restarting', version: '1.9.0' });

        for (const status of [downloading, restarting]) {
            expect(status).toContain(
                'class="button button--icon-only button--primary button--sm pointer-events-none"'
            );
            expect(status).not.toContain('<button');
            expect(status).not.toContain('disabled');
            expect(status).not.toContain('role="status"');
        }
    });
});

function renderStatus(status: DesktopUpdateStatus) {
    return renderToStaticMarkup(
        <DesktopUpdateStatusControl
            onCheck={() => undefined}
            onUpdate={() => undefined}
            status={status}
        />
    );
}
