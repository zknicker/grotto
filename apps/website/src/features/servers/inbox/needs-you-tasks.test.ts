import { expect, test } from 'bun:test';
import { type NeedsYouTask, selectNeedsYouTasks } from './needs-you-tasks.ts';

const viewer = 'user_me';

function task(overrides: Partial<NeedsYouTask> & { id: string }) {
    return {
        assigneeUserId: null,
        createdByUserId: null,
        status: 'in_review' as const,
        ...overrides,
    };
}

test('keeps review tasks the viewer created or is reserved for', () => {
    const items = [
        task({ createdByUserId: viewer, id: 'mine-filed' }),
        task({ assigneeUserId: viewer, id: 'mine-reserved' }),
    ];

    expect(selectNeedsYouTasks(items, viewer).map((item) => item.id)).toEqual([
        'mine-filed',
        'mine-reserved',
    ]);
});

test('drops review tasks belonging to somebody else', () => {
    const items = [
        task({ assigneeUserId: 'user_other', createdByUserId: 'user_other', id: 'theirs' }),
    ];

    expect(selectNeedsYouTasks(items, viewer)).toEqual([]);
});

test('drops the viewer own tasks that are not waiting on review', () => {
    const items = [
        task({ createdByUserId: viewer, id: 'todo', status: 'todo' }),
        task({ assigneeUserId: viewer, id: 'in-progress', status: 'in_progress' }),
        task({ createdByUserId: viewer, id: 'done', status: 'done' }),
        task({ createdByUserId: viewer, id: 'closed', status: 'closed' }),
    ];

    expect(selectNeedsYouTasks(items, viewer)).toEqual([]);
});

test('needs a known viewer before it can claim anything is theirs', () => {
    const items = [task({ createdByUserId: viewer, id: 'mine-filed' })];

    expect(selectNeedsYouTasks(items, null)).toEqual([]);
});
