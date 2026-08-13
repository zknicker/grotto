import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkChatIds, expandEvalCleanupChatIds } from './cleanup-chats.mjs';
import { marker } from './kit.mjs';
import {
    clampLanes,
    findPoolTemplate,
    isReady,
    matchesKind,
    poolLaneCapacity,
    poolProfiles,
} from './pool.mjs';
import { activeLine, formatWall, pad } from './render.mjs';
import { buildSummary, runStamp, slug } from './report.mjs';
import { AssertionError, createExpect, defineScenario, isScenario } from './scenario.mjs';
import { createPoolState } from './state.mjs';
import { createTurnObserver, isMissingProcedure } from './turns.mjs';

const readyAgent = {
    availability: 'idle',
    desiredModelId: 'terra-1',
    desiredRuntimeId: 'pi',
    effectiveModelId: 'terra-1',
    effectiveRuntimeId: 'pi',
    handle: 'eval-worker-1',
    id: 'agt_worker',
    missingResources: [],
    status: 'applied',
};

describe('marker', () => {
    test('carries the EVAL prefix and a six character suffix', () => {
        const value = marker();
        expect(value).toMatch(/^EVAL-[A-Z2-9]{6}$/u);
        expect(value).not.toBe(marker());
    });

    test('supports a custom prefix and a bare suffix', () => {
        expect(marker('TASK')).toMatch(/^TASK-[A-Z2-9]{6}$/u);
        expect(marker('')).toMatch(/^[A-Z2-9]{6}$/u);
    });
});

describe('expect helper', () => {
    test('records passing gates', () => {
        const assertions = [];
        createExpect(assertions)('in_progress', 'task status').toBe('in_progress');
        expect(assertions).toEqual([{ label: 'task status', ok: true }]);
    });

    test('reports the actual value on failure', () => {
        const assertions = [];
        const check = createExpect(assertions);
        expect(() => check('todo', 'task status').toBe('in_progress')).toThrow(AssertionError);
        expect(assertions[0].ok).toBe(false);
        expect(assertions[0].message).toBe('task status: expected "in_progress", got "todo"');
    });

    test('names the container on length and containment failures', () => {
        const check = createExpect();
        expect(() => check(['a', 'b'], 'replies').toHaveLength(1)).toThrow(
            'replies: expected length 1, got 2 in ["a", "b"]'
        );
        expect(() => check('no token here', 'reply').toContain('EVAL-ABC123')).toThrow(
            'reply: expected "no token here" to contain "EVAL-ABC123"'
        );
    });
});

describe('defineScenario', () => {
    test('normalizes agent requests and marks the module shape', () => {
        const scenario = defineScenario({
            agents: ['worker', { cleanWorkspace: true, kind: 'coordinator' }],
            name: '  demo  ',
            run: () => undefined,
        });
        expect(isScenario(scenario)).toBe(true);
        expect(scenario.name).toBe('demo');
        expect(scenario.agents).toEqual([
            { cleanWorkspace: false, kind: 'worker' },
            { cleanWorkspace: true, kind: 'coordinator' },
        ]);
    });

    test('rejects unknown agent kinds and missing run functions', () => {
        const unknownKind = () =>
            defineScenario({ agents: ['captain'], name: 'x', run: () => undefined });
        expect(unknownKind).toThrow(/Unknown agent kind/u);
        expect(() => defineScenario({ name: 'x' })).toThrow(/needs a run function/u);
    });
});

describe('cleanup expansion', () => {
    const tasks = [{ task: { chatId: 'cht_parent', threadChatId: 'cht_thread' } }];

    test('adds the Threads owned by a requested parent Chat', () => {
        expect(expandEvalCleanupChatIds(['cht_parent'], tasks)).toEqual([
            'cht_parent',
            'cht_thread',
        ]);
    });

    test('deletes an explicitly tracked Thread without claiming its parent', () => {
        // A Thread promoted from a standing Owner DM is scenario-owned while
        // the DM itself is preserved: the Thread alone is a legal cleanup set.
        expect(expandEvalCleanupChatIds(['cht_thread'], tasks)).toEqual(['cht_thread']);
    });

    test('chunks ids to the twenty id server limit', () => {
        const ids = Array.from({ length: 45 }, (_, index) => `cht_${index}`);
        expect(chunkChatIds(ids).map((chunk) => chunk.length)).toEqual([20, 20, 5]);
    });
});

describe('pool helpers', () => {
    test('maps handles to their pool kind', () => {
        expect(matchesKind('eval-worker-2', 'worker')).toBe(true);
        expect(matchesKind('eval-coordinator', 'worker')).toBe(false);
        expect(poolProfiles.filter((profile) => profile.kind === 'worker')).toHaveLength(3);
    });

    test('readiness needs applied, idle, matching, and complete resources', () => {
        expect(isReady(readyAgent)).toBe(true);
        expect(isReady({ ...readyAgent, availability: 'working' })).toBe(false);
        expect(isReady({ ...readyAgent, effectiveModelId: 'other' })).toBe(false);
        expect(isReady({ ...readyAgent, missingResources: ['pi'] })).toBe(false);
        expect(isReady(undefined)).toBe(false);
    });

    test('finds a template by model hint', () => {
        expect(findPoolTemplate([readyAgent])?.id).toBe('agt_worker');
        expect(findPoolTemplate([{ ...readyAgent, desiredModelId: 'sol' }])).toBeUndefined();
    });

    test('clamps lanes to the worker pool', () => {
        expect(poolLaneCapacity).toBe(3);
        expect(clampLanes(2)).toBe(2);
        expect(clampLanes(4)).toBe(3);
        expect(clampLanes('0')).toBe(3);
        expect(clampLanes(undefined)).toBe(3);
    });
});

describe('pool state', () => {
    test('reading leftovers keeps them until a delete is confirmed', async () => {
        const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'agent-tests-state-'));
        const state = createPoolState({ repositoryRoot });
        await state.remember('eval-worker-1', 'cht_a');
        await state.remember('eval-worker-1', 'cht_b');

        expect(await state.peek('eval-worker-1')).toEqual(['cht_a', 'cht_b']);
        // A failed cleanup deletes nothing, so the next lease still sees both.
        expect(await state.peek('eval-worker-1')).toEqual(['cht_a', 'cht_b']);

        await state.forget(['cht_a']);
        expect(await state.peek('eval-worker-1')).toEqual(['cht_b']);
    });
});

describe('turn observability fallback', () => {
    test('only an unrouted tRPC path counts as a missing capability', () => {
        expect(isMissingProcedure(unroutedPathError('agent.turns'))).toBe(true);
        expect(isMissingProcedure(deniedError('agent.turns'))).toBe(false);
        expect(isMissingProcedure(new Error('agent.turns failed (404): {"error":{}}'))).toBe(false);
        expect(isMissingProcedure(new Error('agent.turns failed (500): boom'))).toBe(false);
    });

    test('an unrouted agent.turns falls back to agent.activity', async () => {
        const observer = createTurnObserver({
            serverId: 'srv_1',
            trpc: (path) => {
                if (path === 'agent.turns') {
                    throw unroutedPathError(path);
                }
                return Promise.resolve([{ messageCount: 2, runId: 'run_1', status: 'completed' }]);
            },
        });
        const turns = await observer.listTurns('agt_1');
        expect(turns[0]).toMatchObject({ outputProduced: true, source: 'activity' });
        expect(observer.capabilities().turns).toBe(false);
    });

    test('a denial fails the scenario instead of disabling the capability', async () => {
        const observer = createTurnObserver({
            serverId: 'srv_1',
            trpc: (path) => {
                throw deniedError(path);
            },
        });
        await expect(observer.listTurns('agt_1')).rejects.toThrow(/No Agent exists/u);
        await expect(observer.listDeliveries('agt_1')).rejects.toThrow(/No Agent exists/u);
        expect(observer.capabilities()).toEqual({ deliveries: null, turns: null });
    });

    test('an unrouted agent.deliveries reads as no delivery ledger', async () => {
        const observer = createTurnObserver({
            serverId: 'srv_1',
            trpc: (path) => {
                throw unroutedPathError(path);
            },
        });
        expect(await observer.listDeliveries('agt_1')).toBeNull();
        expect(observer.capabilities().deliveries).toBe(false);
    });
});

describe('cli scenario selection', () => {
    const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));

    test('lists the scenarios it would run', () => {
        const listed = runCli(['--list']);
        expect(listed.status).toBe(0);
        expect(listed.stdout).toContain('task-thread-routing');
    });

    // A filter that matches nothing must fail, and must fail before the run
    // reaches the dev stack: a green "0 passed" would read as a passing lane.
    test('a filter that matches nothing exits non-zero', () => {
        const empty = runCli(['--only', 'no-such-scenario']);
        expect(empty.status).toBe(1);
        expect(empty.stderr).toContain('no-such-scenario');
        expect(empty.stdout).toBe('');
    });

    function runCli(args) {
        const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
        return { status: result.status, stderr: result.stderr, stdout: result.stdout };
    }
});

describe('report shape', () => {
    test('summary carries scenarios, timing, and errors', () => {
        const summary = buildSummary({
            scenarios: [
                { assertions: [], error: new Error('nope'), name: 'a', ok: false, seconds: 3 },
                { name: 'b', ok: true, seconds: 2 },
            ],
            startedAt: '2026-08-12T00:00:00.000Z',
            wallSeconds: 5,
        });
        expect(summary.scenarios[0].error).toContain('nope');
        expect(summary.scenarios[1]).toEqual({ assertions: [], name: 'b', ok: true, seconds: 2 });
        expect(summary.wallSeconds).toBe(5);
    });

    test('slug and stamp are filesystem safe', () => {
        expect(slug('task thread routing!')).toBe('task-thread-routing');
        expect(runStamp(new Date('2026-08-12T09:41:07.123Z'))).toBe('20260812T094107');
    });
});

describe('render helpers', () => {
    test('pads the scenario column and formats the wall clock', () => {
        expect(pad('demo', 8)).toBe('demo    ');
        expect(formatWall(125)).toBe('2m 5s');
    });

    test('active line carries the index, name, phase, and elapsed seconds', () => {
        const line = activeLine({
            index: 1,
            name: 'task-thread-routing',
            phase: 'turn active',
            startedAt: Date.now() - 24_000,
        });
        expect(line).toBe('▶ 01 task-thread-routing       turn active · 24s');
    });
});

/** The body a Server sends when the tRPC path itself is not routed. */
function unroutedPathError(path) {
    return trpcError(path, 404, `No "query"-procedure on path "${path}"`);
}

/** The body an authorization or unknown-Agent refusal sends: also NOT_FOUND. */
function deniedError(path) {
    return trpcError(path, 404, 'No Agent exists on this Server.');
}

function trpcError(path, status, message) {
    const payload = {
        error: { code: -32_004, data: { code: 'NOT_FOUND', httpStatus: status, path }, message },
    };
    return new Error(`${path} failed (${status}): ${JSON.stringify(payload)}`);
}
