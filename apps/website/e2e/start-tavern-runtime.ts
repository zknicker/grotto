import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentExecutorInput } from '../../runtime/src/tavern/agent-executor.ts';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const runtimeRoot = path.join(workspaceRoot, '.context', 'e2e', runId, 'tavern-runtime');

rmSync(runtimeRoot, { force: true, recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(path.join(runtimeRoot, 'agent', 'workspace'), { recursive: true });
writeFileSync(
    path.join(runtimeRoot, 'agent', 'workspace', 'QA_KICKOFF_TASK.md'),
    '# QA kickoff task\n\nThis file exists so e2e tool-read tests can inspect a deterministic workspace fixture.\n'
);

process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
process.env.TAVERN_AGENT_HOME = path.join(runtimeRoot, 'agent');
process.env.TAVERN_AGENT_WORKSPACE = path.join(runtimeRoot, 'agent', 'workspace');
process.env.TAVERN_RUNTIME_TOKEN = process.env.TAVERN_RUNTIME_TOKEN ?? 'e2e-runtime-token';
process.env.NODE_ENV ??= 'test';

process.chdir(workspaceRoot);

const { setAgentExecutorForTesting } = await import(
    '../../runtime/src/tavern/agent-turn-runner.ts'
);
const { createHarnessAgentExecutor, setHarnessAgentFactoryForTesting } = await import(
    '../../runtime/src/tavern/harness-agent-executor.ts'
);
// The agent's only reply channel is `grotto message send` (D1); the fake
// harness drives the exact function the CLI's send route calls so a real
// durable message lands, instead of writing chat rows directly.
const { sendAgentMessage } = await import('../../runtime/src/tavern/agent-send.ts');
// A real agent runs `grotto message check` before replying, which serves the
// delivered rows and clears the channel/thread freshness hold; the fake
// mirrors that so its immediate send is not held as stale.
const { checkAgentMessages } = await import('../../runtime/src/tavern/agent-inbox-api.ts');

// The e2e mock fakes only the model harness; the real executor runs — real
// instructions, prompt assembly, activity persistence, widget parsing, empty
// and silent-reply handling — so e2e exercises the product turn path.
setHarnessAgentFactoryForTesting(createFakeHarnessAgentFactory());
setAgentExecutorForTesting(createHarnessAgentExecutor());

// The runtime entry dispatches on argv and only starts the server on the `serve` subcommand.
process.argv = [process.argv[0] ?? 'bun', process.argv[1] ?? 'start-tavern-runtime.ts', 'serve'];

await import('../../runtime/src/index.ts');

// Nothing bootstraps agents lazily anymore (ADR 0018): the e2e stack owns
// its fixture agent, created through the normal runtime create path with a
// fixed id so specs can address its DM deterministically.
const { createRuntimeAgent } = await import('../../runtime/src/tavern/agent-create.ts');
await createRuntimeAgent({
    id: 'agt_otto_e2e',
    isAdmin: true,
    name: 'Otto',
    workspaceFolder: process.env.TAVERN_AGENT_WORKSPACE,
});

function createFakeHarnessAgentFactory() {
    return ((input: AgentExecutorInput) => ({
        createSession: () =>
            Promise.resolve({
                destroy: () => Promise.resolve(),
                sessionId:
                    input.agentSession.runtimeSessionId ?? `ses_e2e_${input.agentSession.id}`,
                stop: () => Promise.resolve({}),
            }),
        stream: () =>
            Promise.resolve({ fullStream: e2eTurnParts(input), text: Promise.resolve('') }),
    })) as unknown as Parameters<typeof setHarnessAgentFactoryForTesting>[0];
}

// Marker-driven model behavior: the turn's prompt is the drain delivery
// (envelopes plus trailer), never raw chat content. Prompts opt into a tool
// read; everything else replies deterministically through the agent's only
// output channel, `grotto message send` (D1) — a bare `Start.` turn (or any
// turn whose envelope carries no addressable target) has nothing to send.
async function* e2eTurnParts(input: AgentExecutorInput) {
    const prompt = input.prompt;
    const readTarget = prompt.match(/(?:Read|against) `([^`]+)`/iu)?.[1] ?? null;

    if (readTarget) {
        yield {
            input: { file_path: readTarget },
            toolCallId: 'tool_e2e_read',
            toolName: 'read',
            type: 'tool-call',
        };
        yield {
            input: { file_path: readTarget },
            output: '# QA kickoff task',
            toolCallId: 'tool_e2e_read',
            toolName: 'read',
            type: 'tool-result',
        };
    }

    const target = deliveryTarget(prompt);
    if (!target) {
        return;
    }

    // Mirrors the real agent's `grotto message check` before replying.
    checkAgentMessages(input.agent.id);
    // The exact function the CLI's `grotto message send` invokes
    // (`/api/agent/messages/send` -> agent-send.ts) — this is what makes the
    // durable reply land; the text parts above are execution evidence only.
    sendAgentMessage(input.agent.id, {
        content: e2eResponseContent(input),
        nonce: `e2e_${input.runId}`,
        target,
    });
}

// The drain prompt embeds one `[target=... msg=... ...]` envelope per
// pending message (inbox-drain.ts); the most recent one is who to reply to.
function deliveryTarget(prompt: string) {
    const matches = [...prompt.matchAll(/\[target=(\S+)/gu)];
    return matches.at(-1)?.[1] ?? null;
}

function e2eResponseContent(input: AgentExecutorInput) {
    const exactReply = parseExactReply(input.prompt);
    if (exactReply) {
        return exactReply;
    }
    return `${input.agent.name}: received a message.`;
}

// A session reset re-delivers the whole unseen backlog in one batched
// prompt (envelopes oldest first); the most recent envelope is the live ask,
// so its marker wins over any stale ones dragged along by catch-up.
function parseExactReply(prompt: string) {
    const quoted = [...prompt.matchAll(/reply exactly\s+`([^`]+)`/giu)];
    if (quoted.length > 0) {
        return quoted.at(-1)?.[1] ?? null;
    }
    const bare = [...prompt.matchAll(/reply exactly\s+([A-Z0-9_-]+)/giu)];
    return bare.at(-1)?.[1] ?? null;
}
