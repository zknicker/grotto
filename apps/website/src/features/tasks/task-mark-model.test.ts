import { expect, test } from 'bun:test';
import {
    deriveHandledTaskMarks,
    formatTaskDuration,
    type HandledTaskMarkMessage,
    handledTaskHoverRows,
    isTaskWorkingNow,
    type TaskMarkFacts,
    taskClaimMarkState,
    taskMarkMotion,
} from './task-mark-model.ts';

test('a live claim reads as work happening now', () => {
    expect(taskClaimMarkState(facts({ live: true }))).toBe('live');
});

test('a claim nobody is running reads as idle', () => {
    expect(taskClaimMarkState(facts({}))).toBe('idle');
    expect(taskClaimMarkState(facts({ runFailed: true }))).toBe('interrupted');
});

test('a finished claim settles and then leaves the anchor', () => {
    expect(taskClaimMarkState(facts({ status: 'done' }))).toBe('done');
    // Liveness cannot outrank the outcome: a settled claim is settled.
    expect(taskClaimMarkState(facts({ live: true, status: 'done' }))).toBe('done');
});

test('a task with an empty Thread wears its mark whatever its tier', () => {
    // Tier is a lens, not a mark: the empty Thread is what leaves the header
    // the only place the task can state itself.
    expect(taskClaimMarkState(facts({ live: true }))).toBe('live');
    expect(taskClaimMarkState(facts({ status: 'in_review' }))).toBe('in_review');
    expect(taskClaimMarkState(facts({ status: 'todo' }))).toBe('todo');
});

test('a task its Thread surface states carries no header mark', () => {
    expect(taskClaimMarkState(facts({ live: true, threadStatesTask: true }))).toBe('none');
    expect(taskClaimMarkState(facts({ status: 'done', threadStatesTask: true }))).toBe('none');
    expect(taskClaimMarkState(facts({ status: 'todo', threadStatesTask: true }))).toBe('none');
});

test('a closed task has nothing left moving to mark', () => {
    expect(taskClaimMarkState(facts({ status: 'closed' }))).toBe('none');
});

test('only in-progress liveness replaces a status glyph with the ellipsis', () => {
    expect(isTaskWorkingNow({ live: true, status: 'in_progress' })).toBe(true);
    expect(isTaskWorkingNow({ live: false, status: 'in_progress' })).toBe(false);
    expect(isTaskWorkingNow({ live: true, status: 'done' })).toBe(false);
});

test('a finished task hands its receipt to the assignee’s next message', () => {
    const marks = deriveHandledTaskMarks([
        human('msg_ask', { assigneeAgentId: 'agt_blippy', status: 'done' }),
        human('msg_unrelated', null),
        agent('msg_other_agent', 'agt_cove'),
        agent('msg_answer', 'agt_blippy'),
        agent('msg_later', 'agt_blippy'),
    ]);

    expect([...marks.keys()]).toEqual(['msg_answer']);
    expect(marks.get('msg_answer')).toEqual({
        anchorMessageId: 'msg_ask',
        claimedAt: '2026-09-08T12:00:00.000Z',
        doneAt: '2026-09-08T12:00:20.000Z',
        number: 4,
    });
});

test('two tasks closed in one visit take the next two replies, in order', () => {
    const marks = deriveHandledTaskMarks([
        human('msg_first', { assigneeAgentId: 'agt_blippy', number: 1, status: 'done' }),
        human('msg_second', { assigneeAgentId: 'agt_blippy', number: 2, status: 'done' }),
        agent('msg_reply_one', 'agt_blippy'),
        agent('msg_reply_two', 'agt_blippy'),
    ]);

    expect(marks.get('msg_reply_one')?.number).toBe(1);
    expect(marks.get('msg_reply_two')?.number).toBe(2);
});

test('an unfinished, discussed, or unassigned task hands out no receipt', () => {
    const open = deriveHandledTaskMarks([
        human('msg_open', { assigneeAgentId: 'agt_blippy' }),
        human('msg_discussed', {
            assigneeAgentId: 'agt_blippy',
            status: 'done',
            threadStatesTask: true,
        }),
        human('msg_unassigned', { status: 'done' }),
        agent('msg_answer', 'agt_blippy'),
    ]);

    expect(open.size).toBe(0);
});

test('a tracked task that finished with an empty Thread still hands out a receipt', () => {
    const marks = deriveHandledTaskMarks([
        human('msg_ask', { assigneeAgentId: 'agt_blippy', status: 'done' }),
        agent('msg_answer', 'agt_blippy'),
    ]);

    expect(marks.get('msg_answer')?.number).toBe(4);
});

test('a reply that is itself a task keeps its own mark instead of a receipt', () => {
    const marks = deriveHandledTaskMarks([
        human('msg_ask', { assigneeAgentId: 'agt_blippy', status: 'done' }),
        {
            agentId: 'agt_blippy',
            id: 'msg_agent_task',
            task: { ...taskFacts({ assigneeAgentId: 'agt_blippy' }), assigneeAgentId: null },
        },
        agent('msg_answer', 'agt_blippy'),
    ]);

    expect([...marks.keys()]).toEqual(['msg_answer']);
});

test('the receipt card answers claimed, held, and done', () => {
    const rows = handledTaskHoverRows(
        {
            anchorMessageId: 'msg_ask',
            claimedAt: '2026-09-08T12:00:00.000Z',
            doneAt: '2026-09-08T12:00:20.000Z',
            number: 4,
        },
        Date.parse('2026-09-08T12:01:00.000Z')
    );

    expect(rows.map((row) => row.label)).toEqual(['Claimed', 'Took', 'Done']);
    expect(rows[1].value).toBe('20s');
});

test('a claim with no claim time says so rather than inventing a duration', () => {
    const rows = handledTaskHoverRows({
        anchorMessageId: 'msg_ask',
        claimedAt: null,
        doneAt: '2026-09-08T12:00:20.000Z',
        number: 4,
    });

    expect(rows[0].value).toBe('—');
    expect(rows[1].value).toBe('—');
});

test('claim durations keep the seconds a one-turn claim is measured in', () => {
    expect(formatTaskDuration(18_000)).toBe('18s');
    expect(formatTaskDuration(95_000)).toBe('1m 35s');
    expect(formatTaskDuration(120_000)).toBe('2m');
    expect(formatTaskDuration(3_600_000)).toBe('1h');
    expect(formatTaskDuration(5_400_000)).toBe('1h 30m');
});

test('reduced motion keeps the three dots and drops every moving part', () => {
    const moving = taskMarkMotion(false);
    const still = taskMarkMotion(true);

    expect(moving.animated).toBe(true);
    expect(moving.dots.map((dot) => dot.delay)).toEqual([0, 0.16, 0.32]);
    expect(moving.settleMs).toBe(200);
    expect(still.animated).toBe(false);
    expect(still.dots).toHaveLength(3);
    expect(still.dots.every((dot) => dot.delay === 0)).toBe(true);
    expect(still.settleMs).toBe(0);
});

function taskFacts(overrides: Partial<TaskMarkFacts & { assigneeAgentId: string | null }> = {}) {
    return {
        assigneeAgentId: null,
        claimedAt: '2026-09-08T12:00:00.000Z',
        live: false,
        number: 4,
        status: 'in_progress' as const,
        threadStatesTask: false,
        updatedAt: '2026-09-08T12:00:20.000Z',
        ...overrides,
    };
}

function facts(overrides: Partial<TaskMarkFacts>): TaskMarkFacts {
    return { ...taskFacts(), ...overrides };
}

function human(
    id: string,
    task: Partial<TaskMarkFacts & { assigneeAgentId: string | null }> | null
): HandledTaskMarkMessage {
    return { agentId: null, id, task: task === null ? null : taskFacts(task) };
}

function agent(id: string, agentId: string): HandledTaskMarkMessage {
    return { agentId, id, task: null };
}
