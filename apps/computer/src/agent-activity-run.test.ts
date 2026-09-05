import { afterAll, expect, test } from 'bun:test';
import { Effect, Fiber } from 'effect';
import type { ComputerAgentActivityUpdate } from './agent-activity.ts';
import { AgentActivityRun } from './agent-activity-run.ts';
import { makeDaemonRuntime } from './daemon-runtime.ts';

const runtime = makeDaemonRuntime();
afterAll(() => runtime.dispose());

test('pairs success exactly once and records an exact aggregate', async () => {
    const events: ComputerAgentActivityUpdate[] = [];
    const run = new AgentActivityRun(runtime, (event) => events.push(event));

    await run.runPromise({ category: 'running_command', key: 'tool:one' }, async () => 'done');

    expect(events.map(({ phase }) => phase)).toEqual(['started', 'completed']);
    expect(events.every((event) => !Number.isNaN(Date.parse(event.occurredAt)))).toBe(true);
    expect(run.snapshot()).toEqual({
        operations: [
            {
                category: 'running_command',
                completed: 1,
                failed: 0,
                interrupted: 0,
            },
        ],
    });
});

test('settles keyed operations exactly once', async () => {
    const events: ComputerAgentActivityUpdate[] = [];
    const run = new AgentActivityRun(runtime, (event) => events.push(event));

    await run.start({ category: 'using_tool', key: 'tool:one', toolRef: 'search' });
    await run.start({ category: 'using_tool', key: 'tool:one', toolRef: 'search' });
    await run.close('interrupted');
    await run.finish('tool:one', 'completed');

    expect(events.map(({ phase }) => phase)).toEqual(['started', 'interrupted']);
    expect(run.snapshot().operations[0]).toEqual({
        category: 'using_tool',
        completed: 0,
        failed: 0,
        interrupted: 1,
    });
});

test('uses Cause interruption for lexical operations', async () => {
    const events: ComputerAgentActivityUpdate[] = [];
    const run = new AgentActivityRun(runtime, (event) => events.push(event));

    await runtime.runPromise(
        Effect.gen(function* () {
            const fiber = yield* Effect.fork(
                run.around(Effect.never, { category: 'thinking', key: 'thinking' })
            );
            yield* Effect.yieldNow();
            yield* Fiber.interrupt(fiber);
        })
    );

    expect(events.map(({ phase }) => phase)).toEqual(['started', 'interrupted']);
});
