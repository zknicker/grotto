// bun run test:agents — headless agent-behavior tests against the running dev
// stack. No browser, no Playwright: scenarios drive the same hosted tRPC and
// Agent API contracts the App uses.
//
//   bun scripts/agent-tests/cli.mjs [--only <substring>] [--list] [--json]
//                                   [--pool] [--lanes <n>]

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createEvalHarness } from '../eval-harness.mjs';
import { createAgentTestKit, ensureAgentTestPool } from './kit.mjs';
import { clampLanes, poolLaneCapacity } from './pool.mjs';
import { createRenderer, formatWall } from './render.mjs';
import { buildSummary, buildTranscript, createReportWriter, runStamp } from './report.mjs';
import { createExpect, isScenario } from './scenario.mjs';

const scenariosDirectory = fileURLToPath(new URL('./scenarios/', import.meta.url));
const repositoryRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

const options = parseArgv(process.argv.slice(2));
const scenarios = filterScenarios(await loadScenarios(), options.only);

if (options.list) {
    const listed = scenarios.map((scenario) => ({
        contract: scenario.contract,
        name: scenario.name,
    }));
    process.stdout.write(
        options.json
            ? `${JSON.stringify(listed, null, 4)}\n`
            : `${listed.map((scenario) => `  ${scenario.name}`).join('\n')}\n`
    );
    process.exit(0);
}

// An empty scenario set is a failure, not a clean run — and it is decided
// before anything reaches the dev stack, so a typo costs no live agent time.
if (!(options.pool || scenarios.length > 0)) {
    process.stderr.write(
        options.only
            ? `No agent-test scenario name contains ${JSON.stringify(options.only)}.\n  list them with: bun run test:agents --list\n`
            : `No agent-test scenarios found in ${scenariosDirectory}.\n`
    );
    process.exit(1);
}

const stamp = runStamp();
const report = createReportWriter({ repositoryRoot, stamp });
const renderer = createRenderer({ quiet: options.json });
const startedAt = new Date().toISOString();
const startedAtMs = Date.now();

if (options.pool) {
    const harness = await createEvalHarness({ evalName: 'agent-tests', repositoryRoot });
    const agents = await ensureAgentTestPool(harness, { repositoryRoot });
    process.stdout.write(
        `${agents.map((agent) => `  ✓ @${agent.handle}  ${agent.desiredRuntimeId}/${agent.desiredModelId}`).join('\n')}\n`
    );
    await harness.cleanup();
    exit(0);
}

const results = await runScenarios().catch(reportInfraFailure);
const wallSeconds = Math.round((Date.now() - startedAtMs) / 1000);
const summary = buildSummary({ scenarios: results, startedAt, wallSeconds });
await report.writeSummary(summary);
renderer.stop();

const passed = results.filter((result) => result.ok).length;
if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 4)}\n`);
} else {
    renderer.summary(
        results,
        `${passed}/${results.length} passed · ${formatWall(wallSeconds)} · report ${report.relativeDirectory}`
    );
}
exit(passed === results.length ? 0 : 1);

async function runScenarios() {
    const harness = await createEvalHarness({ evalName: 'agent-tests', repositoryRoot });
    const collected = [];
    try {
        await ensureAgentTestPool(harness, { repositoryRoot });
        const queue = scenarios.map((scenario, index) => ({ index: index + 1, scenario }));
        const lanes = Math.min(options.lanes, Math.max(queue.length, 1));
        await Promise.all(
            Array.from({ length: lanes }, async () => {
                for (;;) {
                    const next = queue.shift();
                    if (!next) {
                        return;
                    }
                    collected.push(await runScenario(harness, next));
                }
            })
        );
    } finally {
        await harness.cleanup();
    }
    return scenarios
        .map((scenario) => collected.find((result) => result.name === scenario.name))
        .filter(Boolean);
}

async function runScenario(harness, { index, scenario }) {
    const key = scenario.name;
    const startedAtScenario = Date.now();
    renderer.start(key, { index, name: scenario.name });
    const assertions = [];
    const kit = createAgentTestKit(harness, { repositoryRoot, scenarioName: scenario.name });
    const expect = createExpect(assertions);
    let lease = null;
    let error = null;

    try {
        renderer.phase(key, 'leasing');
        lease = await kit.lease(scenario.agents);
        renderer.phase(key, 'running');
        await scenario.run({
            agents: lease.agents,
            expect,
            kit,
            log: (phase) => renderer.phase(key, phase),
            marker: kit.marker,
            settleTurn: (agentId, settleOptions = {}) =>
                kit.settleTurn(agentId, {
                    onPhase: (phase) => renderer.phase(key, phase),
                    ...settleOptions,
                }),
        });
    } catch (cause) {
        error = cause;
    }

    // The verdict clock stops here: teardown is not scenario time. Cleanup is
    // bounded — a chat delete stalled behind a still-active turn defers its
    // ids to the next lease via the state ledger instead of stretching this
    // run; the ledger only forgets ids the delete confirmed.
    const seconds = Math.round((Date.now() - startedAtScenario) / 1000);
    await Promise.race([
        kit.cleanup().catch((cause) => {
            process.stderr.write(`\ncleanup deferred for ${key}: ${String(cause).slice(0, 200)}\n`);
        }),
        new Promise((resolve) => setTimeout(resolve, 60_000).unref?.()).then(() => {
            process.stderr.write(
                `\ncleanup for ${key} exceeded 60s; deferring to the next lease.\n`
            );
        }),
    ]);
    lease?.release();

    const result = {
        agents: lease?.agents.map((agent) => agent.handle) ?? [],
        assertions,
        error,
        name: scenario.name,
        ok: !error,
        seconds,
    };
    await report.writeScenario(scenario.name, buildTranscript({ error, kit, result, scenario }));
    renderer.finish(key, { error, ok: result.ok, seconds });
    return result;
}

/** Setup failures are the whole run failing, not one scenario failing. */
function reportInfraFailure(error) {
    renderer.stop();
    process.stderr.write(
        `\nThe agent tests could not reach the dev stack: ${error}\nStart it with bun run dev, then rerun.\n`
    );
    return [{ assertions: [], error, name: 'agent-tests setup', ok: false, seconds: 0 }];
}

async function loadScenarios() {
    const entries = await readdir(scenariosDirectory).catch(() => []);
    const loaded = [];
    for (const entry of entries.filter((file) => file.endsWith('.mjs')).sort()) {
        const module = await import(pathToFileURL(path.join(scenariosDirectory, entry)).href);
        const scenario = module.default;
        if (!isScenario(scenario)) {
            throw new Error(`${entry} must default-export defineScenario(...).`);
        }
        loaded.push(scenario);
    }
    return loaded;
}

function filterScenarios(loaded, only) {
    return only ? loaded.filter((scenario) => scenario.name.includes(only)) : loaded;
}

/** Unknown args abort: a typo must never quietly become a full live-agent run. */
function parseArgv(argv) {
    const parsed = { json: false, lanes: poolLaneCapacity, list: false, only: null, pool: false };
    const rest = [...argv];
    while (rest.length > 0) {
        const arg = rest.shift();
        if (arg === '--json' || arg === '--list' || arg === '--pool') {
            parsed[arg.slice(2)] = true;
        } else if (arg === '--only') {
            parsed.only = rest.shift() ?? null;
        } else if (arg === '--lanes') {
            const requested = rest.shift();
            parsed.lanes = clampLanes(requested);
            if (String(parsed.lanes) !== String(requested)) {
                process.stderr.write(
                    `Running ${parsed.lanes} lanes: the agent-test pool has ${poolLaneCapacity} worker Agents.\n`
                );
            }
        } else {
            process.stderr.write(
                `Unknown argument ${arg}.\n` +
                    '  usage: bun run test:agents [--only <substring>] [--list] [--json] [--pool] [--lanes <n>]\n'
            );
            process.exit(2);
        }
    }
    return parsed;
}

/** Clerk's headless client keeps refresh timers alive after the run finishes. */
function exit(code) {
    process.exitCode = code;
    setTimeout(() => process.exit(code), 0);
}
