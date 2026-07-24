import type {
    DevToolkitScenario,
    TavernSimulateTurnReceipt,
    TavernUpsertResponseActivityRequest,
} from '@tavern/api';
import { agentRuntimeRoutes, tavernSimulateTurnRequestSchema } from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import {
    createDelivery,
    createMessage,
    getChat,
    getMessage,
    listMessages,
    updateStreamingMessage,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api';
import { badRequest, json, notFound, readJson } from './http';

// Dev toolkit: scripted streaming turns for exercising live chat surfaces
// (status row, turn drawer, pane streaming) without a model. Only available
// on the development stack.
export function isDevToolkitEnabled() {
    return process.env.TAVERN_DEV_STACK === '1';
}

const defaultPaceMs = 2500;

export async function handleDevToolkitRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method !== 'POST' || url.pathname !== agentRuntimeRoutes.devSimulateTurn) {
        return null;
    }

    if (!isDevToolkitEnabled()) {
        return notFound();
    }

    const parsed = tavernSimulateTurnRequestSchema.safeParse(await readJson(request));

    if (!parsed.success) {
        return badRequest(parsed.error.message);
    }

    let simulation: ReturnType<typeof simulateDevelopmentTurn>;
    try {
        simulation = simulateDevelopmentTurn({
            chatId: parsed.data.chat_id,
            paceMs: parsed.data.pace_ms,
            scenario: parsed.data.scenario,
        });
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }

    // The scripted turn keeps streaming after the receipt returns.
    simulation.run.catch((error) => {
        console.error('Dev toolkit simulated turn failed', error);
    });

    return json(simulation.receipt, 202);
}

export function simulateDevelopmentTurn(input: {
    chatId: string;
    db?: Database;
    paceMs?: number;
    scenario?: DevToolkitScenario;
}): { receipt: TavernSimulateTurnReceipt; run: Promise<void> } {
    if (!isDevToolkitEnabled()) {
        throw new Error('The dev toolkit is only available on the development stack.');
    }

    const db = input.db ?? getDb();
    const chat = getChat(input.chatId, db);

    if (!chat) {
        throw new Error(`Chat ${input.chatId} does not exist.`);
    }

    const agentIds = chat.participants
        .filter((participant) => participant.kind === 'agent')
        .map((participant) => participant.id);
    const messages = listMessages(input.chatId, { limit: 200 }, db);
    const requestMessageId = messages.messages.at(-1)?.id ?? null;
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const paceMs = input.paceMs ?? defaultPaceMs;
    const scenario = input.scenario ?? 'tooling';
    const buildContext = (agentId: string, suffix = ''): SimulationContext => {
        const runId = `run_devsim_${stamp}${suffix}`;

        return {
            agentId,
            chatId: input.chatId,
            db,
            paceMs,
            requestMessageId,
            responseId: `rsp_devsim_${stamp}${suffix}`,
            runId,
            runtime: {
                agentId,
                runId,
                // Delivered messages must carry a turn reference or the runtime
                // event projection cannot map them.
                sessionKey: `agent:${agentId}:tavern:devsim:${input.chatId}`,
                source: 'dev-toolkit',
                startedAt: new Date().toISOString(),
            },
        };
    };

    if (scenario === 'multi-agent') {
        if (agentIds.length < 2) {
            throw new Error(
                'The multi-agent scenario needs a chat with two agents — use the seeded "team demo" chat.'
            );
        }

        const contexts = agentIds
            .slice(0, 2)
            .map((agentId, index) => buildContext(agentId, `_${index === 0 ? 'a' : 'b'}`));
        const run = runMultiAgentScenario(contexts[0], contexts[1]);

        return {
            receipt: { response_id: contexts[0].responseId, run_id: contexts[0].runId },
            run,
        };
    }

    const firstAgentId = agentIds[0];
    if (!firstAgentId) {
        throw new Error(`Chat ${input.chatId} has no agent seat to simulate a turn for.`);
    }
    const context = buildContext(firstAgentId);
    const run = runScenario(scenario, context);

    return { receipt: { response_id: context.responseId, run_id: context.runId }, run };
}

interface SimulationContext {
    agentId: string;
    chatId: string;
    db: Database;
    paceMs: number;
    requestMessageId: string | null;
    responseId: string;
    runId: string;
    runtime: Record<string, string>;
}

function runScenario(
    scenario: Exclude<DevToolkitScenario, 'multi-agent'>,
    context: SimulationContext
) {
    switch (scenario) {
        case 'failure':
            return runFailureScenario(context);
        case 'narration':
            return runNarrationScenario(context);
        default:
            return runToolingScenario(context);
    }
}

// Two agents answering the same request at once: both runs stream live so the
// status stack shows two seats working, then the replies land one after the
// other. The second seat starts a beat later so the overlap reads naturally.
async function runMultiAgentScenario(first: SimulationContext, second: SimulationContext) {
    const secondRun = (async () => {
        await sleep(Math.ceil(second.paceMs / 2));
        await runSecondSeatScenario(second);
    })();

    await Promise.all([runToolingScenario(first), secondRun]);
}

async function runSecondSeatScenario(context: SimulationContext) {
    const pause = () => sleep(context.paceMs);

    upsertRun(context, { status: 'running' });
    await pause();

    narration(context, 'Checking the queue for anything risky before I answer.');
    await pause();

    toolActivity(context, 1, 'read_file', 'QUEUE.md', { running: true });
    await pause();

    toolActivity(context, 1, 'read_file', 'QUEUE.md', { running: false });
    upsertRun(context, {
        status: 'running',
        summary: 'Two items stand out —',
    });
    await pause();

    completeRun(
        context,
        'Two items stand out: the schema change needs a fresh-database pass, and the calendar token expires Friday.'
    );
}

async function runToolingScenario(context: SimulationContext) {
    const pause = () => sleep(context.paceMs);

    upsertRun(context, { status: 'running' });
    await pause();

    toolActivity(context, 1, 'exec', 'ls -la', { running: true });
    await pause();

    narration(context, 'I will inspect the workspace layout before making any changes.');
    await pause();

    toolActivity(context, 1, 'exec', 'ls -la', { running: false });
    toolActivity(context, 2, 'read_file', 'docs/README.md', { running: true });
    await pause();

    toolActivity(context, 2, 'read_file', 'docs/README.md', { running: false });
    toolActivity(context, 3, 'search_files', 'workspace layout', { running: true });
    await pause();

    toolActivity(context, 3, 'search_files', 'workspace layout', { running: false });
    upsertRun(context, {
        status: 'running',
        summary: 'The workspace looks well organized —',
    });
    await pause();

    upsertRun(context, {
        status: 'running',
        summary: simulatedReplyText,
    });
    await pause();

    completeRun(context, simulatedReplyText);
}

// The long-form narration turn: preamble → reasoning → tools with intra-turn
// updates between them → reply. Exercises every real harness step type and
// the replace-in-place narration slot across several swaps.
async function runNarrationScenario(context: SimulationContext) {
    const pause = () => sleep(context.paceMs);

    upsertRun(context, { status: 'running' });
    await pause();

    narration(context, 'I will inspect the workspace layout before making any changes.', 1);
    await pause();

    reasoning(
        context,
        'The docs map should match the folder layout; checking the top level first, then the runtime docs.',
        1
    );
    await pause();

    toolActivity(context, 1, 'exec', 'ls -la', { running: true });
    await pause();

    toolActivity(context, 1, 'exec', 'ls -la', { running: false });
    narration(context, 'Top-level layout matches the map — reading the runtime docs next.', 2);
    await pause();

    toolActivity(context, 2, 'read_file', 'docs/internals/runtime.md', { running: true });
    await pause();

    toolActivity(context, 2, 'read_file', 'docs/internals/runtime.md', { running: false });
    narration(context, 'Runtime docs are current too — doing a final reference sweep.', 3);
    await pause();

    toolActivity(context, 3, 'search_files', 'stale references', { running: true });
    await pause();

    toolActivity(context, 3, 'search_files', 'stale references', { running: false });
    upsertRun(context, {
        status: 'running',
        summary: 'The workspace looks well organized —',
    });
    await pause();

    completeRun(context, simulatedReplyText);
}

async function runFailureScenario(context: SimulationContext) {
    const pause = () => sleep(context.paceMs);

    upsertRun(context, { status: 'running' });
    await pause();

    toolActivity(context, 1, 'exec', 'bun run build', { running: true });
    await pause();

    upsertResponseActivity(
        context.chatId,
        context.responseId,
        {
            artifact_ids: [],
            completed_at: new Date().toISOString(),
            detail: 'bun run build',
            id: `act_${context.runId}_tool_1`,
            kind: 'tool_call',
            metadata: {
                runtime: {
                    ...context.runtime,
                    toolCallId: `${context.runId}_t1`,
                    toolName: 'exec',
                },
                tool: { arguments: { command: 'bun run build' }, name: 'exec' },
            },
            started_at: new Date(Date.now() - context.paceMs).toISOString(),
            status: 'failed',
            title: 'bun run build',
        },
        context.db
    );
    await pause();

    upsertResponse(
        context.chatId,
        {
            completed_at: new Date().toISOString(),
            id: context.responseId,
            metadata: {
                error: 'Simulated failure: the build command exited with code 1.',
                runtime: context.runtime,
            },
            participant_id: context.agentId,
            request_message_id: context.requestMessageId,
            status: 'failed',
        },
        context.db
    );
}

const simulatedReplyText =
    'The workspace looks well organized — docs are current and the layout matches the map.';

function upsertRun(context: SimulationContext, input: { status: 'running'; summary?: string }) {
    upsertResponse(
        context.chatId,
        {
            id: context.responseId,
            metadata: { runtime: context.runtime },
            participant_id: context.agentId,
            request_message_id: context.requestMessageId,
            status: input.status,
            summary: input.summary,
        },
        context.db
    );

    if (input.summary) {
        upsertTurnPost(context, input.summary);
    }
}

// createPost/editPost, same as the real turn runner: the turn's message row
// exists from its first visible content and evolves in place until the
// delivery finalizes it (specs/chat-timeline.md).
function upsertTurnPost(context: SimulationContext, content: string) {
    const id = simulatedPostId(context);
    const metadata = { runtime: { ...context.runtime, streaming: true } };

    if (getMessage(id, context.db)) {
        updateStreamingMessage(context.chatId, { content, id, metadata }, context.db);
        return;
    }

    createMessage(
        context.chatId,
        {
            attachments: [],
            author_id: context.agentId,
            content,
            id,
            metadata,
            role: 'assistant',
        },
        context.db
    );
}

function simulatedPostId(context: SimulationContext) {
    return `msg_${context.runId}_assistant`;
}

function completeRun(context: SimulationContext, content: string) {
    const receipt = createDelivery(
        context.chatId,
        {
            agent_id: context.agentId,
            id: `del_${context.runId}`,
            message: {
                attachments: [],
                author_id: context.agentId,
                content,
                id: simulatedPostId(context),
                metadata: { runtime: context.runtime },
                role: 'assistant',
            },
            metadata: { runtime: context.runtime },
            turn_id: context.runId,
        },
        context.db
    );
    upsertResponse(
        context.chatId,
        {
            completed_at: new Date().toISOString(),
            id: context.responseId,
            metadata: { runtime: { ...context.runtime, completedAt: new Date().toISOString() } },
            participant_id: context.agentId,
            request_message_id: context.requestMessageId,
            response_message_id: receipt.message.id,
            status: 'completed',
        },
        context.db
    );
}

function narration(context: SimulationContext, text: string, index = 1) {
    upsertTurnPost(context, text);
    upsertResponseActivity(
        context.chatId,
        context.responseId,
        {
            artifact_ids: [],
            completed_at: new Date().toISOString(),
            detail: text,
            id: `act_${context.runId}_msg_${index}`,
            kind: 'message',
            metadata: { runtime: { ...context.runtime, messagePhase: 'commentary' } },
            started_at: new Date().toISOString(),
            status: 'completed',
            title: 'Assistant reply',
        },
        context.db
    );
}

function reasoning(context: SimulationContext, text: string, index = 1) {
    upsertResponseActivity(
        context.chatId,
        context.responseId,
        {
            artifact_ids: [],
            completed_at: new Date().toISOString(),
            detail: text,
            id: `act_${context.runId}_reasoning_${index}`,
            kind: 'reasoning',
            metadata: { runtime: context.runtime },
            started_at: new Date().toISOString(),
            status: 'completed',
            summary: text,
            title: 'Reasoning',
        },
        context.db
    );
}

function toolActivity(
    context: SimulationContext,
    index: number,
    toolName: string,
    subject: string,
    state: { running: boolean }
) {
    const now = new Date().toISOString();
    const activity: TavernUpsertResponseActivityRequest = {
        artifact_ids: [],
        completed_at: state.running ? null : now,
        detail: subject,
        id: `act_${context.runId}_tool_${index}`,
        kind: 'tool_call',
        metadata: {
            runtime: {
                ...context.runtime,
                toolCallId: `${context.runId}_t${index}`,
                toolName,
            },
            tool: {
                arguments: { subject },
                name: toolName,
                ...(state.running ? {} : { result: 'ok' }),
            },
        },
        started_at: state.running ? now : new Date(Date.now() - context.paceMs).toISOString(),
        status: state.running ? 'running' : 'completed',
        title: subject,
    };

    upsertResponseActivity(context.chatId, context.responseId, activity, context.db);
}

function sleep(ms: number) {
    return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}
