import { expect, test } from 'bun:test';
import {
    serverTaskAssignmentInput,
    serverTaskUpdateInput,
    toggledServerTaskLabelIds,
} from './server-task-control-input.ts';

test('keeps expectedVersion on assignment and metadata writes', () => {
    const task = { id: 'message_one', version: 7 };

    expect(serverTaskAssignmentInput('server_one', task, 'user_two')).toEqual({
        assigneeUserId: 'user_two',
        expectedVersion: 7,
        messageId: 'message_one',
        serverId: 'server_one',
    });
    expect(serverTaskUpdateInput('server_one', task, { priority: 'urgent' })).toEqual({
        expectedVersion: 7,
        messageId: 'message_one',
        patch: { priority: 'urgent' },
        serverId: 'server_one',
    });
});

test('toggles task labels without duplicates and preserves catalog order', () => {
    expect(toggledServerTaskLabelIds(['label_one'], 'label_two', true)).toEqual([
        'label_one',
        'label_two',
    ]);
    expect(toggledServerTaskLabelIds(['label_one', 'label_two'], 'label_one', false)).toEqual([
        'label_two',
    ]);
});
