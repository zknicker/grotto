import { expect, test } from 'bun:test';
import { selectNeedsYouCount } from './needs-you-count.ts';
import type { StalledClaimTask } from './stalled-claims.ts';

function task(overrides: Partial<StalledClaimTask> & { id: string }) {
    return {
        live: false,
        origin: 'composed' as const,
        status: 'todo' as const,
        tier: 'tracked' as const,
        ...overrides,
    };
}

test('adds the open Asks to the stalled claims', () => {
    const count = selectNeedsYouCount({
        askCount: 2,
        tasks: [
            task({ id: 'stalled', origin: 'claimed', status: 'in_progress' }),
            task({ id: 'another', origin: 'claimed', status: 'in_progress' }),
        ],
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
            task({ id: 'in-review', status: 'in_review' }),
            task({ id: 'todo' }),
        ],
    });

    expect(count).toBe(0);
});
