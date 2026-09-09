import { expect, test } from 'bun:test';
import { resolveTaskTier, stampsTaskTracked, type TaskTierRow } from './task-tier.ts';

const claimed: TaskTierRow = {
    messageId: 'msg_one',
    origin: 'claimed',
    status: 'in_progress',
    trackedAt: null,
};
const quiet = { assigneeThreadMessages: false, hasAsk: false };

test('an untouched Agent claim is background', () => {
    expect(resolveTaskTier(claimed, quiet)).toBe('background');
    expect(resolveTaskTier({ ...claimed, status: 'done' }, quiet)).toBe('background');
});

test('a human-made task is always tracked', () => {
    expect(resolveTaskTier({ ...claimed, origin: 'composed' }, quiet)).toBe('tracked');
    expect(resolveTaskTier({ ...claimed, origin: 'converted' }, quiet)).toBe('tracked');
});

// A peer Agent or a bystander replying in the anchor's Thread is exactly the
// noise a Thread exists to hold. Only the claimant working there, or an Ask,
// says the claim needs watching.
test('the assignee working in the Thread, or an Ask, makes it tracked', () => {
    expect(resolveTaskTier(claimed, { ...quiet, assigneeThreadMessages: true })).toBe('tracked');
    expect(resolveTaskTier(claimed, { ...quiet, hasAsk: true })).toBe('tracked');
});

test('review and surviving a settled run are recorded as one stamp', () => {
    expect(resolveTaskTier({ ...claimed, trackedAt: new Date() }, quiet)).toBe('tracked');
});

test('a claim parked outside its own lifecycle is tracked', () => {
    expect(resolveTaskTier({ ...claimed, status: 'todo' }, quiet)).toBe('tracked');
    expect(resolveTaskTier({ ...claimed, status: 'in_review' }, quiet)).toBe('tracked');
    expect(resolveTaskTier({ ...claimed, status: 'closed' }, quiet)).toBe('tracked');
});

// A claim reopened to `todo` used to read tracked only while it sat there:
// moving it back to `in_progress` made it background again and it vanished
// from the Board. Every status outside the claim's own lifecycle persists the
// stamp, so the tier is one-way.
test('leaving the claim lifecycle is persisted, so the tier cannot flap back', () => {
    expect(stampsTaskTracked('todo')).toBe(true);
    expect(stampsTaskTracked('in_review')).toBe(true);
    expect(stampsTaskTracked('closed')).toBe(true);
    expect(stampsTaskTracked('in_progress')).toBe(false);
    expect(stampsTaskTracked('done')).toBe(false);
    expect(stampsTaskTracked(undefined)).toBe(false);
    for (const status of ['todo', 'in_review', 'closed'] as const) {
        const stamped = { ...claimed, status, trackedAt: new Date() };
        expect(resolveTaskTier(stamped, quiet)).toBe('tracked');
        expect(resolveTaskTier({ ...stamped, status: 'in_progress' }, quiet)).toBe('tracked');
        expect(resolveTaskTier({ ...stamped, status: 'done' }, quiet)).toBe('tracked');
    }
});
