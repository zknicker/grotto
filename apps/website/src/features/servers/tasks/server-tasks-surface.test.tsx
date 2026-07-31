import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServerTaskState } from './server-tasks-surface.tsx';

test('renders a durable error state without replacing it with an empty board', () => {
    const html = renderToStaticMarkup(
        <ServerTaskState
            description="You no longer have access to this Server."
            title="Tasks unavailable"
            tone="error"
        />
    );

    expect(html).toContain('Tasks unavailable');
    expect(html).toContain('You no longer have access');
    expect(html).toContain('role="alert"');
});

test('renders loading copy as a non-error snapshot state', () => {
    const html = renderToStaticMarkup(
        <ServerTaskState description="Fetching the Server task snapshot." title="Loading tasks" />
    );

    expect(html).toContain('Loading tasks');
    expect(html).toContain('Fetching the Server task snapshot.');
    expect(html).not.toContain('role="alert"');
});
