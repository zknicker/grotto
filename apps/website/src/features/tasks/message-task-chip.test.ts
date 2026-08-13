import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    type MessageTask,
    MessageTaskChip,
    messageTaskAssigneeLabel,
} from './message-task-chip.tsx';

test('labels known task owners without guessing a handle-less actor kind', () => {
    expect(messageTaskAssigneeLabel(task({ handle: 'otto', id: 'agent_otto' }))).toBe('@otto');
    expect(
        messageTaskAssigneeLabel(task({ handle: null, id: 'user_123456789', kind: 'human' }))
    ).toBe('Human 456789');
    expect(messageTaskAssigneeLabel(task({ handle: null, id: 'agent_missing' }))).toBeNull();
});

test('renders compact task metadata with the assignee identity', () => {
    const markup = renderToStaticMarkup(
        createElement(MessageTaskChip, {
            assigneeProfile: { avatarUrl: '/otto.png', name: 'Otto' },
            task: task({ handle: 'otto', id: 'a' }),
        })
    );

    expect(markup).not.toContain('data-slot="chip"');
    expect(markup).toContain('Task #1');
    expect(markup).toContain('Otto');
    expect(markup).toContain('data-slot="avatar-fallback"');
    expect(markup).toContain('height:14px');
});

function task(assignee: NonNullable<MessageTask['assignee']>): MessageTask {
    return { assignee, number: 1, status: 'todo' };
}
