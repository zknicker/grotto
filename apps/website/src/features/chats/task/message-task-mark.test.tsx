import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MessageTask } from '../../tasks/task-presentation.ts';
import { MessageTaskMark, messageTaskMarkLabel } from './message-task-mark.tsx';

test('the task mark reads at header scale with a neutral identity line', () => {
    const markup = renderToStaticMarkup(
        <MessageTaskMark
            assigneeProfile={{ avatarUrl: null, name: 'Blippy' }}
            onOpenThread={() => undefined}
            task={task()}
        />
    );

    expect(markup).not.toContain('data-slot="chip"');
    expect(markup).toContain('Task #2');
    expect(markup).toContain('Blippy');
    expect(markup).toContain('text-muted');
    expect(markup).toContain('text-xs');
});

test('an openable task mark is a real button with a keyboard-only ring', () => {
    const markup = renderToStaticMarkup(
        <MessageTaskMark onOpenThread={() => undefined} task={task()} />
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('focus-visible:ring-focus');
    expect(markup).toContain('cursor-(--cursor-interactive)');
});

test('a task mark without a thread affordance stays static', () => {
    const markup = renderToStaticMarkup(<MessageTaskMark task={task()} />);

    expect(markup).not.toContain('<button');
    expect(markup).toContain('Task #2');
});

test('the mark names its status and assignee for screen readers', () => {
    expect(messageTaskMarkLabel(task(), 'Blippy')).toBe('Task #2 — In review, Blippy. Open thread');
    expect(messageTaskMarkLabel(task(), null)).toBe('Task #2 — In review. Open thread');
});

function task(): MessageTask {
    return {
        assignee: { handle: 'blippy', id: 'agent_blippy', kind: 'agent' },
        number: 2,
        status: 'in_review',
    };
}
