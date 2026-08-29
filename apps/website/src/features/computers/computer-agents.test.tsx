import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComputerAgentGrid } from './computer-agents.tsx';

test('Computer Agents render as a HeroUI Pro data grid', () => {
    const html = renderToStaticMarkup(
        <ComputerAgentGrid
            onOpenAgent={() => undefined}
            rows={[
                {
                    avatarUrl: null,
                    availability: 'idle',
                    displayName: 'Blippy',
                    id: 'agent-blippy',
                    model: 'GPT-5.6 Sol',
                    runtime: 'Codex',
                    version: { color: 'accent', detail: 'Up to date', version: 'v1.1.0' },
                },
            ]}
            state={{ status: 'ready' }}
        />
    );

    expect(html).toContain('data-slot="data-grid"');
    expect(html).toContain('aria-label="Agents on this Computer"');
    expect(html).toContain('Agent');
    expect(html).toContain('Runtime');
    expect(html).toContain('Model');
    expect(html).toContain('Status');
    expect(html).toContain('Agent version');
    expect(html).toContain('Blippy');
    expect(html).toContain('Codex');
    expect(html).toContain('GPT-5.6 Sol');
    expect(html).toContain('Online');
    expect(html).toContain('v1.1.0');
    expect(html).toContain('Up to date');
    expect(html).toContain('text-success');
    expect(html).toContain('chip--lg');
    expect(html).not.toContain('min-h-64');
});

test('Computer Agents keep the data grid shell when empty', () => {
    const html = renderToStaticMarkup(
        <ComputerAgentGrid onOpenAgent={() => undefined} rows={[]} state={{ status: 'ready' }} />
    );

    expect(html).toContain('data-slot="data-grid"');
    expect(html).toContain('Agent');
    expect(html).toContain('Runtime');
    expect(html).toContain('Model');
    expect(html).toContain('Status');
    expect(html).toContain('Agent version');
    expect(html).toContain('data-slot="empty-state"');
    expect(html).toContain('min-h-64');
    expect(html).toContain('No Agents assigned');
});

test('Computer Agents collapse pending and failed receipts into out-of-date rows', () => {
    const html = renderToStaticMarkup(
        <ComputerAgentGrid
            onOpenAgent={() => undefined}
            rows={[
                {
                    avatarUrl: null,
                    availability: 'idle',
                    displayName: 'Blippy',
                    id: 'agent-blippy',
                    model: 'GPT-5.6 Sol',
                    runtime: 'Codex',
                    version: {
                        color: 'danger',
                        detail: 'Out of date',
                        version: 'v1.0.2 → v1.1.0',
                    },
                },
                {
                    avatarUrl: null,
                    availability: 'offline',
                    displayName: 'Tiny',
                    id: 'agent-tiny',
                    model: 'Claude Sonnet',
                    runtime: 'Claude Code',
                    version: {
                        color: 'danger',
                        detail: 'Out of date',
                        version: 'v1.0.2 → v1.1.0',
                    },
                },
            ]}
            state={{ status: 'ready' }}
        />
    );

    expect(html.match(/Out of date/gu)).toHaveLength(2);
    expect(html).toContain('text-danger');
});

test('Computer Agents show a loading state before first data', () => {
    const html = renderToStaticMarkup(
        <ComputerAgentGrid onOpenAgent={() => undefined} rows={[]} state={{ status: 'loading' }} />
    );

    expect(html).toContain('Loading Agents');
    expect(html).toContain('min-h-64');
    expect(html).not.toContain('No Agents assigned');
});

test('Computer Agents distinguish an unavailable directory from an empty one', () => {
    const html = renderToStaticMarkup(
        <ComputerAgentGrid
            onOpenAgent={() => undefined}
            rows={[]}
            state={{ onRetry: () => undefined, status: 'unavailable' }}
        />
    );

    expect(html).toContain('Agents unavailable');
    expect(html).toContain('min-h-64');
    expect(html).toContain('Try again');
    expect(html).not.toContain('No Agents assigned');
});
