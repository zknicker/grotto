import type {
    AgentArchetypeId,
    HostedAgent,
    HostedAgentCommand,
    HostedAgentInboxItem,
    HostedAgentTurnSummary,
    HostedReminderScriptCommand,
    HostedReminderScriptResult,
} from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import { emitDurableChatEvent } from '../chats/durable-events.ts';
import { revokeRunnerCredentialsForRun } from '../computers/runner-credentials.ts';
import type { HostedAgentConfigurationRotation } from '../hosted-agents/configure-agent.ts';
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
import { listHostedMessageTaskMap } from '../tasks/task-shape.ts';
import { canBeginAgentDrain, nextAgentChainTurns } from './chain-budget.ts';
import {
    advanceDeliveredCursor,
    advanceSeenForRun,
    deleteSeenQueuedWork,
    recordAgentInboxPierce,
} from './cursors.ts';
import { shouldRetryFailure } from './failure-policy.ts';
import { publishAgentLifecycle } from './lifecycle.ts';
import { recordHostedSessionRotationReceipts } from './session-rotation.ts';
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
    serverId: string;
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
    pierced?: boolean;
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
        const source = input.source ?? 'human';
        await store.ensureDeliveryState(tx, { agentId: input.agentId, serverId: input.serverId });
        await store.enqueuePendingWork(tx, {
            agentId: input.agentId,
            chatId: input.chatId,
            content: input.content,
            dedupeKey: input.dedupeKey,
            pierced: input.pierced,
            serverId: input.serverId,
            source,
        });
        if (input.pierced) {
            await recordAgentInboxPierce(tx, {
                agentId: input.agentId,
                chatId: input.chatId,
                messageId: input.dedupeKey,
                serverId: input.serverId,
            });
        } else if (input.sequence) {
            await advanceDeliveredCursor(tx, {
                agentId: input.agentId,
                chatId: input.chatId,
                sequence: input.sequence,
                serverId: input.serverId,
            });
        }
        // Fresh work re-enables delivery. Human intent also releases the
        // Agent-authored chain ceiling even when older Agent rows precede it.
        await store.clearDeliveryFailures(tx, input.agentId);
        if (source === 'human') {
            await store.setAgentChainTurns(tx, { agentId: input.agentId, turns: 0 });
        }
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
            return {
                chatId: state.activeRunChatId,
                computerId: state.activeRunComputerId,
                runId: state.activeRunId,
            };
        });
        if (kill) {
            if (kill.chatId) {
                publishAgentLifecycle({
                    agentId: input.agentId,
                    chatId: kill.chatId,
                    outcome: 'stopped',
                    phase: 'settled',
                    runId: kill.runId,
                    serverId: input.serverId,
                });
            }
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
            if (interrupted.chatId) {
                publishAgentLifecycle({
                    agentId: input.agentId,
                    chatId: interrupted.chatId,
                    outcome: 'stopped',
                    phase: 'settled',
                    runId: interrupted.runId,
                    serverId: input.serverId,
                });
            }
            this.transport.send(interrupted.computerId, {
                agentId: input.agentId,
                runId: interrupted.runId,
                type: 'stop',
            });
        }
        const plan = await this.db.transaction(async (tx) => {
            await lockServerRow(tx, input.serverId);
            await store.clearDeliveryFailures(tx, input.agentId);
            return this.planDispatch(tx, input.agentId);
        });
        this.emit(plan);
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
            const [rotated] = await tx
                .update(agentsTable)
                .set({
                    sessionGeneration: sql`${agentsTable.sessionGeneration} + 1`,
                    sessionResetKind: input.kind,
                })
                .where(
                    sql`${agentsTable.serverId} = ${input.serverId}
                        and ${agentsTable.id} = ${input.agentId}`
                )
                .returning({ sessionGeneration: agentsTable.sessionGeneration });
            if (!rotated) {
                throw new Error('The Agent session could not be rotated.');
            }
            await tx
                .delete(agentMessageDraftsTable)
                .where(eq(agentMessageDraftsTable.agentId, input.agentId));
            const config = await store.readAgentDispatchConfig(tx, input.agentId);
            const events = await recordHostedSessionRotationReceipts(tx, {
                agentId: input.agentId,
                generation: rotated.sessionGeneration,
                reason: input.kind,
                serverId: input.serverId,
            });
            return {
                chatId: state?.activeRunChatId ?? null,
                computerId: config?.computerId ?? null,
                events,
                runId: state?.activeRunId ?? null,
                sessionGeneration: rotated.sessionGeneration,
            };
        });
        for (const event of result.events) {
            emitDurableChatEvent({ audienceUserId: null, event });
        }
        if (!result.computerId) {
            return;
        }
        if (result.runId) {
            if (result.chatId) {
                publishAgentLifecycle({
                    agentId: input.agentId,
                    chatId: result.chatId,
                    outcome: 'stopped',
                    phase: 'settled',
                    runId: result.runId,
                    serverId: input.serverId,
                });
            }
            this.transport.send(result.computerId, {
                agentId: input.agentId,
                runId: result.runId,
                type: 'stop',
            });
        }
        this.transport.send(result.computerId, {
            agentId: input.agentId,
            kind: input.kind,
            sessionGeneration: result.sessionGeneration,
            type: 'agent-reset',
        });
    }

    /** The Computer accepted a delivery locally — stop retrying it. */
    async onAck(input: { agentId: string; runId: string }): Promise<void> {
        await store.markAccepted(this.db, input);
        const state = await store.readDeliveryState(this.db, input.agentId);
        if (state?.activeRunId === input.runId && state.activeRunChatId) {
            publishAgentLifecycle({
                agentId: input.agentId,
                chatId: state.activeRunChatId,
                phase: 'reading',
                runId: input.runId,
                serverId: state.serverId,
            });
        }
    }

    /** A run settled on the Computer: consume or requeue its work, then drain next. */
    async onTurnSettled(computerId: string, summary: HostedAgentTurnSummary): Promise<void> {
        await recordAgentTurnSummary(this.db, computerId, summary);
        const serverId = await store.readAgentServerId(this.db, summary.agentId);
        if (!serverId) {
            return;
        }
        if (summary.failureKind === 'session-resume' && !summary.outputProduced) {
            const recovery = await this.db.transaction(async (tx) => {
                await lockServerRow(tx, serverId);
                const state = await store.readDeliveryState(tx, summary.agentId);
                if (state?.activeRunId !== summary.runId || !state.activeRunChatId) {
                    return null;
                }
                await revokeRunnerCredentialsForRun(tx, {
                    agentId: summary.agentId,
                    runId: summary.runId,
                    serverId,
                });
                await store.requeuePendingForRun(tx, {
                    agentId: summary.agentId,
                    runId: summary.runId,
                });
                await store.clearActiveRun(tx, summary.agentId);
                const [rotated] = await tx
                    .update(agentsTable)
                    .set({
                        sessionGeneration: sql`${agentsTable.sessionGeneration} + 1`,
                        sessionResetKind: 'session',
                    })
                    .where(
                        and(eq(agentsTable.serverId, serverId), eq(agentsTable.id, summary.agentId))
                    )
                    .returning({ sessionGeneration: agentsTable.sessionGeneration });
                if (!rotated) {
                    throw new Error('The Agent recovery session could not be rotated.');
                }
                await tx
                    .delete(agentMessageDraftsTable)
                    .where(eq(agentMessageDraftsTable.agentId, summary.agentId));
                await store.clearDeliveryFailures(tx, summary.agentId);
                const config = await store.readAgentDispatchConfig(tx, summary.agentId);
                const events = await recordHostedSessionRotationReceipts(tx, {
                    agentId: summary.agentId,
                    generation: rotated.sessionGeneration,
                    reason: 'recovery',
                    serverId,
                });
                return {
                    chatId: state.activeRunChatId,
                    config,
                    events,
                    plan: await this.planDispatch(tx, summary.agentId),
                };
            });
            if (!recovery) {
                return;
            }
            for (const event of recovery.events) {
                emitDurableChatEvent({ audienceUserId: null, event });
            }
            if (isConfigured(recovery.config)) {
                this.transport.send(
                    recovery.config.computerId,
                    configureFrame(summary.agentId, recovery.config)
                );
            }
            publishAgentLifecycle({
                agentId: summary.agentId,
                chatId: recovery.chatId,
                outcome: 'failed',
                phase: 'settled',
                runId: summary.runId,
                serverId,
            });
            this.emit(recovery.plan);
            return;
        }
        const settlement = await this.db.transaction(async (tx) => {
            await lockServerRow(tx, serverId);
            const state = await store.readDeliveryState(tx, summary.agentId);
            if (state?.activeRunId !== summary.runId || !state.activeRunChatId) {
                // A stale or duplicate summary for an already-cleared run: the
                // durable record upsert above is the only effect.
                return null;
            }
            const chatId = state.activeRunChatId;
            await revokeRunnerCredentialsForRun(tx, {
                agentId: summary.agentId,
                runId: summary.runId,
                serverId,
            });
            if (summary.status === 'completed') {
                const completedRows = await store.listPendingForRun(tx, {
                    agentId: summary.agentId,
                    runId: summary.runId,
                });
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
                await store.setAgentChainTurns(tx, {
                    agentId: summary.agentId,
                    turns: nextAgentChainTurns(completedRows, state.agentChainTurns),
                });
                await store.clearActiveRun(tx, summary.agentId);
                return { chatId, plan: await this.planDispatch(tx, summary.agentId) };
            }
            // A failed turn that produced model-visible output must not requeue
            // its work — redelivering it would re-trigger that output. Only a
            // failure with no output is safe to retry. Either way it does not
            // re-drive immediately: repeated failures back off, then degrade.
            if (summary.outputProduced) {
                // A durable Agent send proves the model handled this prompt,
                // even if the runtime failed during later cleanup.
                await advanceSeenForRun(tx, {
                    agentId: summary.agentId,
                    runId: summary.runId,
                    serverId,
                });
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
            const retryable = shouldRetryFailure(summary.failureKind);
            const failures = retryable ? state.consecutiveFailures + 1 : maxDeliveryFailures;
            await store.recordDeliveryFailure(tx, {
                agentId: summary.agentId,
                consecutiveFailures: failures,
                retryAfter:
                    retryable && failures < maxDeliveryFailures ? nextRetryAt(failures) : null,
            });
            return { chatId, plan: null };
        });
        if (!settlement) {
            return;
        }
        publishAgentLifecycle({
            agentId: summary.agentId,
            chatId: settlement.chatId,
            outcome: summary.status,
            phase: 'settled',
            runId: summary.runId,
            serverId,
        });
        this.emit(settlement.plan);
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
            if (agent.retiredAt) {
                this.transport.send(computerId, {
                    agentId: agent.agentId,
                    type: 'agent-retire',
                });
                continue;
            }
            if (agent.desiredModelId && agent.desiredRuntimeId) {
                this.transport.send(computerId, {
                    agentDescription: agent.agentDescription,
                    agentId: agent.agentId,
                    agentName: agent.agentName,
                    archetype: agent.archetype,
                    modelId: agent.desiredModelId,
                    runtimeId: agent.desiredRuntimeId,
                    sessionGeneration: agent.sessionGeneration,
                    sessionResetKind: agent.sessionResetKind,
                    type: 'agent-configure',
                });
            }
            await this.dispatchAgent(agent.agentId, agent.serverId, { resendActive: true });
        }
    }

    /** Best-effort immediate cleanup; the durable retirement tombstone replays on reconnect. */
    retireAgent(input: { agentId: string; computerId: string }): void {
        this.transport.send(input.computerId, {
            agentId: input.agentId,
            type: 'agent-retire',
        });
    }

    /**
     * Applies a validated desired runtime/model snapshot. A changed pair rotates
     * the authoritative session before the Computer receives the new config;
     * a no-op pair only resends configuration.
     */
    async applyAgentConfiguration(input: {
        agent: HostedAgent;
        rotation: HostedAgentConfigurationRotation | null;
    }): Promise<void> {
        const { agent, rotation } = input;
        if (rotation) {
            for (const event of rotation.events) {
                emitDurableChatEvent({ audienceUserId: null, event });
            }
            if (rotation.runId) {
                if (rotation.chatId) {
                    publishAgentLifecycle({
                        agentId: agent.id,
                        chatId: rotation.chatId,
                        outcome: 'stopped',
                        phase: 'settled',
                        runId: rotation.runId,
                        serverId: agent.serverId,
                    });
                }
                this.transport.send(rotation.computerId, {
                    agentId: agent.id,
                    runId: rotation.runId,
                    type: 'stop',
                });
            }
        }
        await this.configureAgent({
            agentDescription: agent.description,
            agentId: agent.id,
            agentName: agent.displayName,
            archetype: agent.archetype,
            computerId: agent.computerId,
            modelId: agent.desiredModelId,
            runtimeId: agent.desiredRuntimeId,
        });
        if (rotation) {
            await this.dispatchAgent(agent.id, agent.serverId);
        }
    }

    /** Best-effort immediate apply; reconnect reconciliation resends the full snapshot. */
    async configureAgent(input: {
        agentDescription: string | null;
        agentId: string;
        agentName: string;
        archetype: AgentArchetypeId | null;
        computerId: string;
        modelId: string;
        runtimeId: string;
    }): Promise<void> {
        const config = await store.readAgentDispatchConfig(this.db, input.agentId);
        if (!config) {
            return;
        }
        this.transport.send(input.computerId, {
            agentDescription: input.agentDescription,
            agentId: input.agentId,
            agentName: input.agentName,
            archetype: input.archetype,
            modelId: input.modelId,
            runtimeId: input.runtimeId,
            sessionGeneration: config.sessionGeneration,
            sessionResetKind: config.sessionResetKind,
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
        await deleteSeenQueuedWork(tx, { agentId, serverId: state.serverId });
        if (state.activeRunId && state.activeRunComputerId) {
            if (!state.acceptedAt || options?.resendActive) {
                await store.markDispatched(tx, { agentId, runId: state.activeRunId });
                // Resend the run exactly as first dispatched: the runtime and
                // model were frozen onto the run, so a mid-flight reconfigure
                // never changes what an in-flight run launches with.
                return {
                    computerId: state.activeRunComputerId,
                    frame: await startFrame(tx, state, config),
                    serverId: state.serverId,
                };
            }
            const pending = await store.listQueuedPending(tx, agentId, maxDrainRows);
            if (pending.length > 0) {
                return {
                    computerId: state.activeRunComputerId,
                    frame: {
                        agentId,
                        inbox: await buildInboxItems(tx, pending),
                        runId: state.activeRunId,
                        totalPending: await store.countQueuedPending(tx, agentId),
                        type: 'notice',
                    },
                    serverId: state.serverId,
                };
            }
            return null;
        }
        if (isBackedOff(state)) {
            return null;
        }
        const runId = createOpaqueId('run');
        const claimed = await store.claimQueuedPending(tx, {
            agentId,
            maxChars: maxDrainChars,
            maxRows: maxDrainRows,
            runId,
        });
        const first = claimed[0];
        if (!first) {
            return null;
        }
        if (!canBeginAgentDrain(claimed, state.agentChainTurns)) {
            await store.requeuePendingForRun(tx, { agentId, runId });
            return null;
        }
        const chatId = first.chatId;
        // Freeze runtime/model onto the run so every resend uses these values.
        await store.beginActiveRun(tx, {
            agentId,
            chatId,
            computerId: config.computerId,
            modelId: config.desiredModelId,
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
                runId,
                runtimeId: config.desiredRuntimeId,
                sessionGeneration: config.sessionGeneration,
                type: 'start',
            },
            serverId: state.serverId,
        };
    }

    private emit(plan: DispatchPlan | null): void {
        if (!(plan && this.transport.send(plan.computerId, plan.frame))) {
            return;
        }
        if (plan.frame.type === 'start') {
            publishAgentLifecycle({
                agentId: plan.frame.agentId,
                chatId: plan.frame.chatId,
                phase: 'working',
                runId: plan.frame.runId,
                serverId: plan.serverId,
            });
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
            return {
                chatId: state.activeRunChatId,
                computerId: state.activeRunComputerId,
                runId: state.activeRunId,
            };
        });
    }
}

interface ConfiguredAgent {
    agentDescription: string | null;
    agentDisplayName: string;
    agentName: string;
    archetype: AgentArchetypeId | null;
    computerId: string;
    desiredModelId: string;
    desiredRuntimeId: string;
    homeTimezone: string;
    sessionGeneration: number;
    sessionResetKind: 'full' | 'session';
}

function isConfigured(config: AgentDispatchConfig | null): config is ConfiguredAgent {
    return Boolean(config?.computerId && config.desiredRuntimeId && config.desiredModelId);
}

function configureFrame(agentId: string, config: ConfiguredAgent): HostedAgentCommand {
    return {
        agentDescription: config.agentDescription,
        agentId,
        agentName: config.agentDisplayName,
        archetype: config.archetype,
        modelId: config.desiredModelId,
        runtimeId: config.desiredRuntimeId,
        sessionGeneration: config.sessionGeneration,
        sessionResetKind: config.sessionResetKind,
        type: 'agent-configure',
    };
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
    config: Pick<
        AgentDispatchConfig,
        'agentDescription' | 'agentName' | 'homeTimezone' | 'sessionGeneration'
    >
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
        runId: state.activeRunId ?? '',
        runtimeId: state.activeRunRuntimeId ?? '',
        sessionGeneration: config.sessionGeneration,
        type: 'start',
    };
}

async function buildInboxItems(
    db: GrottoDatabase,
    rows: store.PendingWorkRow[]
): Promise<HostedAgentInboxItem[]> {
    const serverId = rows[0]?.serverId;
    const taskByMessage = serverId
        ? await listHostedMessageTaskMap(
              db,
              serverId,
              rows.map((row) => row.dedupeKey)
          )
        : new Map();
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
            const [senderAgent] = agentHandle
                ? await db
                      .select({ description: agentsTable.description })
                      .from(agentsTable)
                      .where(
                          and(
                              eq(agentsTable.serverId, row.serverId),
                              eq(agentsTable.handle, agentHandle)
                          )
                      )
                      .limit(1)
                : [];
            return {
                chatId: row.chatId,
                content: row.content,
                createdAt: row.createdAt.toISOString(),
                id: row.dedupeKey,
                ...(row.pierced ? { mentioned: true } : {}),
                ...(senderAgent?.description ? { senderDescription: senderAgent.description } : {}),
                senderHandle: row.source === 'human' ? 'operator' : (agentHandle ?? row.source),
                senderType:
                    row.source === 'human'
                        ? ('human' as const)
                        : agentHandle
                          ? ('agent' as const)
                          : ('system' as const),
                sequence: message?.sequence ?? 1,
                ...(taskByMessage.get(row.dedupeKey)
                    ? { task: taskByMessage.get(row.dedupeKey) }
                    : {}),
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
