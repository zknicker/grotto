import { expect, test } from 'bun:test';
import { selectNeedsYouCount } from './needs-you-count.ts';
import type { NeedsYouTask } from './needs-you-tasks.ts';
import type { StalledClaimTask } from './stalled-claims.ts';

const viewer = 'user_me';

function task(overrides: Partial<NeedsYouTask & StalledClaimTask> & { id: string }) {
    return {
        assigneeUserId: null,
        createdByUserId: null,
        live: false,
        origin: 'composed' as const,
        status: 'todo' as const,
        tier: 'tracked' as const,
        ...overrides,
    };
}

test('adds the open Asks to the stalled claims and the reviews that are yours', () => {
    const count = selectNeedsYouCount({
        askCount: 2,
        tasks: [
            task({ id: 'stalled', origin: 'claimed', status: 'in_progress' }),
            task({ createdByUserId: viewer, id: 'mine-in-review', status: 'in_review' }),
        ],
        viewerUserId: viewer,
    });

    expect(count).toBe(4);
});

test('counts nothing that the section would not list', () => {
    const count = selectNeedsYouCount({
        askCount: 0,
        tasks: [
            task({ id: 'running-claim', live: true, origin: 'claimed', status: 'in_progress' }),
            task({
                id: 'bookkeeping',
                origin: 'claimed',
                status: 'in_progress',
                tier: 'background',
            }),
            task({ createdByUserId: 'user_other', id: 'their-review', status: 'in_review' }),
            task({ createdByUserId: viewer, id: 'my-todo' }),
        ],
        viewerUserId: viewer,
    });

    expect(count).toBe(0);
});

test('counts the Asks even before the viewer is known', () => {
    const count = selectNeedsYouCount({
        askCount: 3,
        tasks: [task({ createdByUserId: viewer, id: 'mine-in-review', status: 'in_review' })],
        viewerUserId: null,
    });

    expect(count).toBe(3);
});
