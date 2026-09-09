import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskClaimHoverContent, TaskClaimMark } from './task-claim-mark.tsx';
import { TaskHandledHoverContent } from './task-handled-mark.tsx';
import type { TaskMarkFacts } from './task-mark-model.ts';

const blippy = { avatarUrl: null, name: 'Blippy' };

test('a live claim shows its claimant and the working ellipsis', () => {
    const markup = renderToStaticMarkup(
        <TaskClaimMark assignee={blippy} task={facts({ live: true })} />
    );

    expect(markup).toContain('task-live-ellipsis');
    expect(markup).toContain('Task #4 claimed by Blippy, working now');
    // Not a status: a claim in flight is not a caution.
    expect(markup).not.toContain('text-warning');
});

test('an idle claim keeps the in-progress glyph and stops moving', () => {
    const markup = renderToStaticMarkup(<TaskClaimMark assignee={blippy} task={facts({})} />);

    expect(markup).toContain('task-claim-mark');
    expect(markup).not.toContain('task-live-ellipsis');
    expect(markup).toContain('Task #4 claimed by Blippy');
});

test('an interrupted claim wears the caution tone', () => {
    const markup = renderToStaticMarkup(
        <TaskClaimMark assignee={blippy} task={facts({ runFailed: true })} />
    );

    expect(markup).toContain('text-warning');
    expect(markup).toContain('run interrupted');
});

test('a claim that was already finished never marks the message', () => {
    const markup = renderToStaticMarkup(
        <TaskClaimMark assignee={blippy} task={facts({ status: 'done' })} />
    );

    expect(markup).toBe('');
});

test('a tracked task carries no claim mark at all', () => {
    const markup = renderToStaticMarkup(
        <TaskClaimMark assignee={blippy} task={facts({ live: true, tier: 'tracked' })} />
    );

    expect(markup).toBe('');
});

test('the claim card names the claimant and offers the one honest way in', () => {
    const markup = renderToStaticMarkup(
        <TaskClaimHoverContent
            assignee={blippy}
            onOpenTask={() => undefined}
            state="live"
            task={facts({ live: true })}
        />
    );

    expect(markup).toContain('Task #4');
    expect(markup).toContain('Claimed by Blippy');
    expect(markup).toContain('Working on it now.');
    expect(markup).toContain('Open task');
});

test('the receipt card states when the claim was taken, held, and finished', () => {
    const markup = renderToStaticMarkup(
        <TaskHandledHoverContent
            mark={{
                anchorMessageId: 'msg_ask',
                claimedAt: '2026-09-08T12:00:00.000Z',
                doneAt: '2026-09-08T12:00:20.000Z',
                number: 4,
            }}
        />
    );

    expect(markup).toContain('Task #4');
    expect(markup).toContain('Claimed');
    expect(markup).toContain('20s');
    // No way in where the host has none to give.
    expect(markup).not.toContain('Open task');
});

function facts(overrides: Partial<TaskMarkFacts>): TaskMarkFacts {
    return {
        claimedAt: '2026-09-08T12:00:00.000Z',
        live: false,
        number: 4,
        status: 'in_progress',
        tier: 'background',
        updatedAt: '2026-09-08T12:00:20.000Z',
        ...overrides,
    };
}
