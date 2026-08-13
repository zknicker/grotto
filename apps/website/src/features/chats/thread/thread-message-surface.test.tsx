import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThreadTaskChipButton } from './thread-message-surface.tsx';

test('task thread trigger wraps neutral task metadata', () => {
    const markup = renderToStaticMarkup(
        <ThreadTaskChipButton
            ariaLabel="Task #2 — Open thread"
            onOpenThread={() => undefined}
            task={{
                assignee: { handle: 'blippy', id: 'agent_blippy', kind: 'agent' },
                number: 2,
                status: 'in_review',
            }}
        />
    );

    expect(markup).not.toContain('data-slot="chip"');
    expect(markup).not.toContain('hover:ring');
    expect(markup).toContain('rounded-2xl');
    expect(markup).toContain('focus-visible:ring-focus');
});
