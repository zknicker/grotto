import { expect, test } from 'bun:test';
import { taskAssignmentInput, taskUpdateInput, toggledTaskLabelIds } from './task-input.ts';

test('keeps expectedVersion on assignment and metadata writes', () => {
    const task = { id: 'message_one', version: 7 };

    expect(taskAssignmentInput('server_one', task, { kind: 'human', userId: 'user_two' })).toEqual({
        assignee: { kind: 'human', userId: 'user_two' },
        expectedVersion: 7,
        messageId: 'message_one',
        serverId: 'server_one',
    });
    // Agents are assignable too, and carry the same versioned envelope.
    expect(taskAssignmentInput('server_one', task, { agentId: 'agt_one', kind: 'agent' })).toEqual({
        assignee: { agentId: 'agt_one', kind: 'agent' },
        expectedVersion: 7,
        messageId: 'message_one',
        serverId: 'server_one',
    });
    expect(taskUpdateInput('server_one', task, { priority: 'urgent' })).toEqual({
        expectedVersion: 7,
        messageId: 'message_one',
        patch: { priority: 'urgent' },
        serverId: 'server_one',
    });
});

test('toggles task labels without duplicates and preserves catalog order', () => {
    expect(toggledTaskLabelIds(['label_one'], 'label_two', true)).toEqual([
        'label_one',
        'label_two',
    ]);
    expect(toggledTaskLabelIds(['label_one', 'label_two'], 'label_one', false)).toEqual([
        'label_two',
    ]);
});
