import type {
    HostedAgentCommand,
    HostedAgentInboxItem,
    HostedAgentTurnSummary,
    HostedReminderScriptCommand,
    HostedReminderScriptResult,
} from '@tavern/api';
import { eq, sql } from 'drizzle-orm';
import { revokeRunnerCredentialsForRun } from '../computers/runner-credentials.ts';
import { recordAgentTurnSummary } from '../hosted-agents/record-agent-turn.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentMessageDraftsTable,
    agentsTable,
    chatMessagesTable,
    chatsTable,
} from '../postgres/schema.ts';
import {
    listReminderScriptCommands,
    settleReminderScript,
} from '../reminders/reminder-script-delivery.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { advanceDeliveredCursor, advanceSeenForRun, deleteServedQueuedWork } from './cursors.ts';
import { composeDrainPrompt } from './prompt.ts';
import type { AgentDeliveryRow, AgentDispatchConfig } from './store.ts';
import * as store from './store.ts';

/** The Server→Computer wire, narrowed to what durable delivery needs. */
export interface DeliveryTransport {
    isOnline(computerId: string): boolean;
    send(computerId: string, frame: HostedAgentCommand): boolean;
}

interface DispatchPlan {
    computerId: string;
    frame: HostedAgentCommand;
}

interface DispatchOptions {
    /** Resend even an acknowledged run — a reconnecting Computer lost its process. */
    resendActive?: boolean;
}

export interface EnqueueInput {
    agentId: string;
    chatId: string;
    content: string;
    /** Idempotency key; a duplicate delivery of the same message is a no-op. */
    dedupeKey: string;
    sequence?: number;
    serverId: string;
    source?: string;
}

/** After how many consecutive failed turns an Agent stops auto-retrying (degraded). */
const maxDeliveryFailures = 5;
const failureBackoffBaseMs = 5000;
const failureBackoffCapMs = 60_000;
/** Bounds one drain so the composed prompt stays well under command/env limits. */
const maxDrainRows = 50;
const maxDrainChars = 24_000;

/**
 * Server-owned durable Agent delivery. All run, stop, and pending-inbox state
 * lives in PostgreSQL, so a restarted Server or a reconnecting Computer resumes
 * without losing or duplicating model-visible work. One Agent serializes its
 * turns through its single delivery row; different Agents dispatch concurrently
 * with no Computer-wide queue. The retry sweep resends unacknowledged
 * deliveries, reconnect reconciliation is idempotent, and a floating-session
 * run drains a bounded slice across all pending targets.
 */
export class AgentDelivery {
    private readonly db: GrottoDatabase;
    private readonly transport: DeliveryTransport;

    constructor(db: GrottoDatabase, transport: DeliveryTransport) {
        this.db = db;
        this.transport = transport;
    }

    /**
     * Records inbound work durably, inside the caller's transaction so the
     * enqueue commits atomically with the message that produced it — a committed
     * message can never leave its wake unqueued. Dispatch to the wire is the
     * separate, recoverable step {@link dispatchAgent}.
     */
    async enqueue(tx: GrottoDatabase, input: EnqueueInput): Promise<void> {
        await store.ensureDeliveryState(tx, { agentId: input.agentId, serverId: input.serverId });
        await store.enqueuePendingWork(tx, {
            agentId: input.agentId,
            chatId: input.chatId,
            content: input.content,
            dedupeKey: input.dedupeKey,
            serverId: input.serverId,
            source: input.source ?? 'human',
        });
        if (input.sequence) {
            await advanceDeliveredCursor(tx, {
                agentId: input.agentId,
                chatId: input.chatId,
                sequence: input.sequence,
                serverId: input.serverId,
            });
        }
        // Fresh human work re-enables a backed-off or degraded Agent.
        await store.clearDeliveryFailures(tx, input.agentId);
    }

    /** Enqueues work in its own transaction and dispatches — the direct-caller path. */
    async deliver(input: EnqueueInput): Promise<void> {
        const plan = await this.db.transaction(async (tx) => {
            await lockServerRow(tx, input.serverId);
            await this.enqueue(tx, input);
            return this.planDispatch(tx, input.agentId);
        });
        this.emit(plan);
    }

    /** Best-effort wire dispatch for an Agent; durable state already committed. */
    async dispatchAgent(
        agentId: string,
        serverId: string,
        options?: DispatchOptions
    ): Promise<void> {
        const plan = await this.db.transaction(async (tx) => {
            await lockServerRow(tx, serverId);
            return this.planDispatch(tx, agentId, options);
        });
        this.emit(plan);
    }

    /**
     * Human Stop: persist the flag, revoke the live run's runner credential so the
     * Stop holds even if the Computer is offline or restarts, requeue the run's
     * work, and best-effort kill the live turn.
     */
    async stop(input: { agentId: string; serverId: string }): Promise<void> {
        const kill = await this.db.transaction(async (tx) => {
            await lockServerRow(tx, input.serverId);
            const state = await store.readDeliveryState(tx, input.agentId);
            await store.setStopped(tx, { ...input, stopped: true });
            if (!(state?.activeRunId && state.activeRunComputerId)) {
                return null;
            }
            await revokeRunnerCredentialsForRun(tx, {
                agentId: input.agentId,
                runId: state.activeRunId,
                serverId: input.serverId,
            });
            await store.requeuePendingForRun(tx, {
                agentId: input.agentId,
                runId: state.activeRunId,
            });
            await store.clearActiveRun(tx, input.agentId);
            return { computerId: state.activeRunComputerId, runId: state.activeRunId };
        });
        if (kill) {
            this.transport.send(kill.computerId, {
                agentId: input.agentId,
                runId: kill.runId,
                type: 'stop',
            });
        }
    }

    /** Human Start: clear the flag and any backoff, then drain the pending inbox. */
    async start(input: { agentId: string; serverId: string }): Promise<void> {
        const plan = await this.db.transaction(async (tx) => {
            await lockServerRow(tx, input.serverId);
            await store.setStopped(tx, { ...input, stopped: false });
            await store.clearDeliveryFailures(tx, input.agentId);
            return this.planDispatch(tx, input.agentId);
        });
        this.emit(plan);
    }

    /** Restarts the executor while preserving the Agent's current session. */
    async restart(input: { agentId: string; serverId: string }): Promise<void> {
        const interrupted = await this.interruptActiveRun(input);
        if (interrupted) {
            this.transport.send(interrupted.computerId, {
                agentId: input.agentId,
                runId: interrupted.runId,
                type: 'stop',
            });
        }
        await this.dispatchAgent(input.agentId, input.serverId);
    }

    /** Rotates session identity; full reset also recreates Computer-local Agent state. */
    async reset(input: { agentId: string; kind: 'full' | 'session'; serverId: string }) {
        const result = await this.db.transaction(async (tx) => {
            await lockServerRow(tx, input.serverId);
            const state = await store.readDeliveryState(tx, input.agentId);
            if (state?.activeRunId) {
                await revokeRunnerCredentialsForRun(tx, {
                    agentId: input.agentId,
                    runId: state.activeRunId,
                    serverId: input.serverId,
                });
                await store.requeuePendingForRun(tx, {
                    agentId: input.agentId,
                    runId: state.activeRunId,
                });
                await store.clearActiveRun(tx, input.agentId);
            }
            await tx
                .update(agentsTable)
                .set({ sessionGeneration: sql`${agentsTable.sessionGeneration} + 1` })
                .where(
                    sql`${agentsTable.serverId} = ${input.serverId}
                        and ${agentsTable.id} = ${input.agentId}`
                );
            await tx
                .delete(agentMessageDraftsTable)
                .where(eq(agentMessageDraftsTable.agentId, input.agentId));
            const config = await store.readAgentDispatchConfig(tx, input.agentId);
            return {
                computerId: config?.computerId ?? null,
                runId: state?.activeRunId ?? null,
            };
        });
        if (!result.computerId) {
            return;
        }
        if (result.runId) {
            this.transport.send(result.computerId, {
                agentId: input.agentId,
                runId: result.runId,
                type: 'stop',
            });
        }
        this.transport.send(result.computerId, {
            agentId: input.agentId,
            kind: input.kind,
            type: 'agent-reset',
        });
    }

    /** The Computer accepted a delivery locally — stop retrying it. */
    async onAck(input: { agentId: string; runId: string }): Promise<void> {
        await store.markAccepted(this.db, input);
    }

    /** A run settled on the Computer: consume or requeue its work, then drain next. */
    async onTurnSettled(computerId: string, summary: HostedAgentTurnSummary): Promise<void> {
        await recordAgentTurnSummary(this.db, computerId, summary);
        const serverId = await store.readAgentServerId(this.db, summary.agentId);
        if (!serverId) {
            return;
        }
        const plan = await this.db.transaction(async (tx) => {
            await lockServerRow(tx, serverId);
            const state = await store.readDeliveryState(tx, summary.agentId);
            if (state?.activeRunId !== summary.runId) {
                // A stale or duplicate summary for an already-cleared run: the
                // durable record upsert above is the only effect.
                return null;
            }
            await revokeRunnerCredentialsForRun(tx, {
                agentId: summary.agentId,
                runId: summary.runId,
                serverId,
            });
            if (summary.status === 'completed') {
                await advanceSeenForRun(tx, {
                    agentId: summary.agentId,
                    runId: summary.runId,
                    serverId,
                });
                await store.deletePendingForRun(tx, {
                    agentId: summary.agentId,
                    runId: summary.runId,
                });
                await store.clearDeliveryFailures(tx, summary.agentId);
                await store.clearActiveRun(tx, summary.agentId);
                return this.planDispatch(tx, summary.agentId);
            }
            // A failed turn that produced model-visible output must not requeue
            // its work — redelivering it would re-trigger that output. Only a
            // failure with no output is safe to retry. Either way it does not
            // re-drive immediately: repeated failures back off, then degrade.
            if (summary.outputProduced) {
                await store.deletePendingForRun(tx, {
                    agentId: summary.agentId,
                    runId: summary.runId,
                });
            } else {
                await store.requeuePendingForRun(tx, {
                    agentId: summary.agentId,
                    runId: summary.runId,
                });
            }
            await store.clearActiveRun(tx, summary.agentId);
            const failures = state.consecutiveFailures + 1;
            await store.recordDeliveryFailure(tx, {
                agentId: summary.agentId,
                consecutiveFailures: failures,
                retryAfter: failures >= maxDeliveryFailures ? null : nextRetryAt(failures),
            });
            return null;
        });
        this.emit(plan);
    }

    /**
     * A Computer (re)connected: resend every in-flight run — acknowledged or not —
     * because the Computer may have lost its live turn, then drain queued work.
     * The Computer dedupes by durable run marker, so resends are idempotent.
     */
    async onComputerReconnect(computerId: string): Promise<void> {
        for (const command of await listReminderScriptCommands(this.db, computerId)) {
            this.transport.send(computerId, command);
        }
        const agents = await store.listComputerAgents(this.db, computerId);
        for (const agent of agents) {
            if (agent.desiredModelId && agent.desiredRuntimeId) {
                this.transport.send(computerId, {
                    agentId: agent.agentId,
                    modelId: agent.desiredModelId,
                    runtimeId: agent.desiredRuntimeId,
                    type: 'agent-configure',
                });
            }
            await this.dispatchAgent(agent.agentId, agent.serverId, { resendActive: true });
        }
    }

    /** Best-effort immediate apply; reconnect reconciliation resends the full snapshot. */
    configureAgent(input: {
        agentId: string;
        computerId: string;
        modelId: string;
        runtimeId: string;
    }): void {
        this.transport.send(input.computerId, {
            agentId: input.agentId,
            modelId: input.modelId,
            runtimeId: input.runtimeId,
            type: 'agent-configure',
        });
    }

    dispatchReminderScript(computerId: string, command: HostedReminderScriptCommand): void {
        this.transport.send(computerId, command);
    }

    async onReminderScriptResult(
        computerId: string,
        result: HostedReminderScriptResult
    ): Promise<void> {
        await settleReminderScript(
            this.db,
            computerId,
            result,
            async (tx, input) => await this.enqueue(tx, input)
        );
        const serverId = await store.readAgentServerId(this.db, result.agentId);
        if (serverId) {
            await this.dispatchAgent(result.agentId, serverId);
        }
    }

    /** Periodic reconciliation: resend unacknowledged deliveries, drain stragglers. */
    async sweep(): Promise<void> {
        const candidates = await store.listDispatchCandidates(this.db, maxDeliveryFailures);
        for (const candidate of candidates) {
            await this.dispatchAgent(candidate.agentId, candidate.serverId);
        }
    }

    /**
     * The single serialization point, run under the Server row lock. It resends an
     * in-flight run (always when reconnecting, otherwise only while
     * unacknowledged), notices a busy Agent about queued work, or drains one
     * pending inbox into a fresh run. Returns the frame to send.
     */
    private async planDispatch(
        tx: GrottoDatabase,
        agentId: string,
        options?: DispatchOptions
    ): Promise<DispatchPlan | null> {
        const state = await store.readDeliveryState(tx, agentId);
        const config = await store.readAgentDispatchConfig(tx, agentId);
        if (!(state && isConfigured(config)) || state.stopped) {
            return null;
        }
        if (!this.transport.isOnline(config.computerId)) {
            return null;
        }
        await deleteServedQueuedWork(tx, { agentId, serverId: state.serverId });
        if (state.activeRunId && state.activeRunComputerId) {
            if (!state.acceptedAt || options?.resendActive) {
                await store.markDispatched(tx, { agentId, runId: state.activeRunId });
                // Resend the run exactly as first dispatched: the runtime and
                // model were frozen onto the run, so a mid-flight reconfigure
                // never changes what an in-flight run launches with.
                return {
                    computerId: state.activeRunComputerId,
                    frame: await startFrame(tx, state, config),
                };
            }
            const pending = await store.listQueuedPending(tx, agentId, maxDrainRows);
            if (pending.length > 0) {
                return {
                    computerId: state.activeRunComputerId,
                    frame: {
                        agentId,
                        pending: await store.countQueuedPending(tx, agentId),
                        runId: state.activeRunId,
                        type: 'notice',
                    },
                };
            }
            return null;
        }
        if (isBackedOff(state)) {
            return null;
        }
        const runId = createOpaqueId('run');
        const claimed = await store.claimQueuedPendingForNextChat(tx, {
            agentId,
            maxChars: maxDrainChars,
            maxRows: maxDrainRows,
            runId,
        });
        const first = claimed[0];
        if (!first) {
            return null;
        }
        const chatId = first.chatId;
        const prompt = composeDrainPrompt(claimed);
        // Freeze runtime/model onto the run so every resend uses these values.
        await store.beginActiveRun(tx, {
            agentId,
            chatId,
            computerId: config.computerId,
            modelId: config.desiredModelId,
            prompt,
            runId,
            runtimeId: config.desiredRuntimeId,
        });
        return {
            computerId: config.computerId,
            frame: {
                agentId,
                ...(config.agentDescription ? { agentDescription: config.agentDescription } : {}),
                agentName: config.agentName,
                chatId,
                homeTimezone: config.homeTimezone,
                inbox: await buildInboxItems(tx, claimed),
                modelId: config.desiredModelId,
                prompt,
                runId,
                runtimeId: config.desiredRuntimeId,
                type: 'start',
            },
        };
    }

    private emit(plan: DispatchPlan | null): void {
        if (plan) {
            this.transport.send(plan.computerId, plan.frame);
        }
    }

    private async interruptActiveRun(input: { agentId: string; serverId: string }) {
        return await this.db.transaction(async (tx) => {
            await lockServerRow(tx, input.serverId);
            const state = await store.readDeliveryState(tx, input.agentId);
            if (!(state?.activeRunId && state.activeRunComputerId)) {
                return null;
            }
            await revokeRunnerCredentialsForRun(tx, {
                agentId: input.agentId,
                runId: state.activeRunId,
                serverId: input.serverId,
            });
            await store.requeuePendingForRun(tx, {
                agentId: input.agentId,
                runId: state.activeRunId,
            });
            await store.clearActiveRun(tx, input.agentId);
            return { computerId: state.activeRunComputerId, runId: state.activeRunId };
        });
    }
}

interface ConfiguredAgent {
    agentDescription: string | null;
    agentName: string;
    computerId: string;
    desiredModelId: string;
    desiredRuntimeId: string;
    homeTimezone: string;
}

function isConfigured(config: AgentDispatchConfig | null): config is ConfiguredAgent {
    return Boolean(config?.computerId && config.desiredRuntimeId && config.desiredModelId);
}

function isBackedOff(state: AgentDeliveryRow): boolean {
    if (state.consecutiveFailures >= maxDeliveryFailures) {
        return true;
    }
    return state.retryAfter !== null && state.retryAfter.getTime() > Date.now();
}

function nextRetryAt(failures: number): Date {
    const backoff = Math.min(failureBackoffCapMs, failureBackoffBaseMs * 2 ** (failures - 1));
    return new Date(Date.now() + backoff);
}

async function startFrame(
    db: GrottoDatabase,
    state: AgentDeliveryRow,
    config: Pick<AgentDispatchConfig, 'agentDescription' | 'agentName' | 'homeTimezone'>
): Promise<HostedAgentCommand> {
    return {
        agentId: state.agentId,
        ...(config.agentDescription ? { agentDescription: config.agentDescription } : {}),
        agentName: config.agentName,
        chatId: state.activeRunChatId ?? '',
        homeTimezone: config.homeTimezone,
        inbox: await buildInboxItems(
            db,
            state.activeRunId
                ? await store.listPendingForRun(db, {
                      agentId: state.agentId,
                      runId: state.activeRunId,
                  })
                : []
        ),
        modelId: state.activeRunModelId ?? '',
        prompt: state.activeRunPrompt ?? '',
        runId: state.activeRunId ?? '',
        runtimeId: state.activeRunRuntimeId ?? '',
        type: 'start',
    };
}

async function buildInboxItems(
    db: GrottoDatabase,
    rows: store.PendingWorkRow[]
): Promise<HostedAgentInboxItem[]> {
    return await Promise.all(
        rows.map(async (row) => {
            const [message] = await db
                .select({ sequence: chatMessagesTable.sequence })
                .from(chatMessagesTable)
                .where(eq(chatMessagesTable.id, row.dedupeKey))
                .limit(1);
            const target = await targetForChat(db, row.chatId);
            const agentHandle = row.source.startsWith('agent:')
                ? row.source.slice('agent:'.length)
                : null;
            return {
                chatId: row.chatId,
                content: row.content,
                createdAt: row.createdAt.toISOString(),
                id: row.dedupeKey,
                senderHandle: row.source === 'human' ? 'operator' : (agentHandle ?? row.source),
                senderType:
                    row.source === 'human'
                        ? ('human' as const)
                        : agentHandle
                          ? ('agent' as const)
                          : ('system' as const),
                sequence: message?.sequence ?? 1,
                target,
            };
        })
    );
}

async function targetForChat(db: GrottoDatabase, chatId: string): Promise<string> {
    const [chat] = await db
        .select({
            anchorMessageId: chatsTable.anchorMessageId,
            kind: chatsTable.kind,
            name: chatsTable.name,
            parentChatId: chatsTable.parentChatId,
        })
        .from(chatsTable)
        .where(eq(chatsTable.id, chatId))
        .limit(1);
    if (!chat || chat.kind === 'dm') {
        return 'dm:@operator';
    }
    if (chat.kind === 'channel') {
        return `#${chat.name}`;
    }
    const parent = chat.parentChatId ? await targetForChat(db, chat.parentChatId) : '#unknown';
    const anchor = chat.anchorMessageId?.replace(/^msg_/u, '').slice(0, 8) ?? 'unknown';
    return `${parent}:${anchor}`;
}
