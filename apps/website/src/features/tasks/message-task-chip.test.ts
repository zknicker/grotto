import { expect, test } from 'bun:test';
import { type MessageTask, messageTaskAssigneeLabel } from './message-task-chip.tsx';

test('labels known task owners without guessing a handle-less actor kind', () => {
    expect(messageTaskAssigneeLabel(task({ handle: 'otto', id: 'agent_otto' }))).toBe('@otto');
    expect(
        messageTaskAssigneeLabel(task({ handle: null, id: 'user_123456789', kind: 'human' }))
    ).toBe('Human 456789');
    expect(messageTaskAssigneeLabel(task({ handle: null, id: 'agent_missing' }))).toBeNull();
});

function task(assignee: NonNullable<MessageTask['assignee']>): MessageTask {
    return { assignee, number: 1, status: 'todo' };
}
