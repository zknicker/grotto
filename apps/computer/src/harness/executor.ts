import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { HarnessV1 } from '@ai-sdk/harness';
import {
    HarnessAgent,
    type HarnessAgentResumeSessionState,
    type HarnessAgentSession,
    type HarnessAgentSkill,
} from '@ai-sdk/harness/agent';
import { createClaudeCode } from '@ai-sdk/harness-claude-code';
import { createCodex } from '@ai-sdk/harness-codex';
import { createGrokBuild } from '@ai-sdk/harness-grok-build';
import { createPi } from '@ai-sdk/harness-pi';
import type { ToolSet } from '@ai-sdk/provider-utils';
import { inspectCoveFactoryGuidance, reconcileCoveFactoryGuidance } from '@grotto/agent-workspace';
import { type AgentReasoningEffort, grottoAgentVersion } from '@grotto/api';
import { type ClaudeUsageSnapshot, normalizeClaudeUsageResponse } from '@grotto/claude-usage';
import { settle } from '@grotto/effect';
import { Cause, Data, Effect, Exit, Stream } from 'effect';
import type { AgentActivityRun } from '../agent-activity-run.ts';
import type { DaemonRuntime } from '../daemon-runtime.ts';
import type { StoredNoticeReceipt } from '../delivery.ts';
import { composeInboxDrain, composeInboxNotice } from '../inbox-format.ts';
import type { AgentInboxItem } from '../launch.ts';
import {
    claimClaudeSdkUsageRefresh,
    saveClaudePlanUsageSnapshot,
} from '../usage/claude-plan-usage-state.ts';
import {
    type createComputerActivityProjector,
    createHarnessActivityProjector,
} from './activity-projector.ts';
import { fingerprintHarnessBootstrap, refreshHarnessBootstrap } from './bootstrap-refresh.ts';
import { bridgeStoreDirForHost, withComputerBridgeBootstrap } from './bridge-bootstrap.ts';
import {
    type ComputerExecutionJournal,
    createComputerExecutionJournal,
} from './execution-journal.ts';
import { composeAgentInstructions } from './instructions.ts';
import { projectMessageForAgent } from './rich-reference-projection.ts';
import { createLocalTrustedSandboxProvider } from './sandbox.ts';
import { clearSessionRestartRequest, isSessionRestartRequested } from './session-restart.ts';
import {
    type AgentSessionState,
    readAgentSessionState,
    resolveTurnSession,
    writeAgentSessionState,
} from './session-store.ts';
import { readAgentSkills } from './skills.ts';
import { createNoticeDelivery } from './steer-inbox-notice.ts';
import {
    addTokenUsage,
    type HarnessTokenUsage,
    normalizeRuntimeUsage,
    readTokenUsage,
    usageContextTokens,
} from './token-usage.ts';

/** Drives one isolated, persistent Codex, Claude Code, Grok Build, or Pi Agent session. */
export interface HarnessTurnInput {
    activity: AgentActivityRun;
    agentId: string;
    agentName: string;
    agentRoot: string;
    dataRoot: string;
    env: Record<string, string>;
    factoryKind: 'cove' | 'ordinary';
    /** Per-turn construction seam for boundary tests; production uses the default Harness Agent. */
    harnessAgentFactory?: HarnessAgentFactory;
    homeDir: string;
    homeTimezone: string;
    inbox: AgentInboxItem[];
    inboxDelivery: 'concrete' | 'notice';
    initialRole: string | null;
    modelId: string;
    onStoredNoticeDelivered?: (receipt: StoredNoticeReceipt) => void;
    reasoningEffort: AgentReasoningEffort;
    registerNoticeSink?: NoticeSinkRegistrar;
    runId: string;
    runtime: DaemonRuntime;
    runtimeId: string;
    sessionGeneration: number;
    signal?: AbortSignal;
    skillsDir: string;
    tools: ToolSet;
    totalPending: number;
    webAccess: 'fetch-only' | 'search' | 'search-only' | null;
    workspaceDir: string;
}

export type NoticeSinkRegistrar = (sink: (notice: string) => Promise<boolean>) => () => void;

export interface HarnessTurnResult {
    aborted: boolean;
    claudePlanUsage: ClaudeUsageSnapshot | null;
    contextTokens: number | null;
    tokenUsage: HarnessTokenUsage | null;
}

export type { HarnessTokenUsage } from './token-usage.ts';

/** Resume was rejected; the caller rotates the generation and cold-starts once. */
export class AgentSessionResumeRejectedError extends Error {
    constructor(
        readonly agentId: string,
        options?: { cause?: unknown }
    ) {
        super(`Agent ${agentId} could not resume its stored runtime session.`, options);
        this.name = 'AgentSessionResumeRejectedError';
    }
}

/** A settled provider failure that may still have billable token usage. */
export class HarnessTurnFailedError extends Error {
    constructor(
        readonly tokenUsage: HarnessTokenUsage | null,
        options: { cause: unknown }
    ) {
        super(
            options.cause instanceof Error ? options.cause.message : String(options.cause),
            options
        );
        this.name = 'HarnessTurnFailedError';
    }
}

class HarnessStreamForeignError extends Data.TaggedError('HarnessStreamForeignError')<{
    readonly cause: unknown;
}> {}

function journalOutcome(
    exit: Exit.Exit<HarnessTurnResult, HarnessStreamForeignError>,
    signal?: AbortSignal
): 'completed' | 'failed' | 'interrupted' {
    if (Exit.isSuccess(exit)) {
        return exit.value.aborted ? 'interrupted' : 'completed';
    }
    return signal?.aborted || Cause.isInterruptedOnly(exit.cause) ? 'interrupted' : 'failed';
}

function journalError(exit: Exit.Exit<HarnessTurnResult, HarnessStreamForeignError>) {
    return Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined;
}

export async function runHarnessTurn(input: HarnessTurnInput): Promise<HarnessTurnResult> {
    const journal = await createComputerExecutionJournal({
        agentRoot: input.agentRoot,
        runId: input.runId,
    });
    const operation = Effect.tryPromise({
        catch: (cause) => new HarnessStreamForeignError({ cause }),
        try: async () => {
            const stored = await readAgentSessionState(input.agentRoot);
            const session = resolveTurnSession(stored, {
                generation: input.sessionGeneration,
                modelId: input.modelId,
                runtimeId: input.runtimeId,
            });
            const restartRequested = await isSessionRestartRequested(input.agentRoot);
            const result = await executeHarnessTurn(input, session, restartRequested, journal);
            if (restartRequested && !result.aborted) {
                await clearSessionRestartRequest(input.agentRoot);
            }
            return result;
        },
    }).pipe(
        Effect.onExit((exit) =>
            Effect.tryPromise({
                catch: (cause) => new HarnessStreamForeignError({ cause }),
                try: () => journal.finish(journalOutcome(exit, input.signal), journalError(exit)),
            }).pipe(Effect.orDie)
        )
    );
    return settle(input.runtime, operation, {
        mapFailure: (failure) => failure.cause,
    });
}

async function executeHarnessTurn(
    input: HarnessTurnInput,
    session: AgentSessionState,
    restartRequested: boolean,
    journal: ComputerExecutionJournal
): Promise<HarnessTurnResult> {
    const skills = await readAgentSkills(input.skillsDir);
    // A changed managed-instruction fingerprint restarts the adapter, preserving conversation.
    const { fingerprint: instructionFingerprint, instructions } = composeAgentInstructions({
        agentId: input.agentId,
        agentName: input.agentName,
        homeTimezone: input.homeTimezone,
        initialRole: input.initialRole,
        webAccess: input.webAccess,
        workspacePath: input.workspaceDir,
    });
    const harness = createHarnessForRuntime(
        input.runtimeId,
        input.modelId,
        input.reasoningEffort,
        input.webAccess !== null,
        bridgeStoreDir()
    );
    const bootstrapFingerprint = await fingerprintHarnessBootstrap({
        abortSignal: input.signal,
        harness,
    });
    const collectClaudePlanUsage =
        input.runtimeId === 'claude-code' && (await claimClaudeSdkUsageRefresh(input.dataRoot));
    const effectiveInput = collectClaudePlanUsage
        ? {
              ...input,
              env: { ...input.env, GROTTO_CLAUDE_USAGE_REFRESH: '1' },
          }
        : input;
    const agent = (effectiveInput.harnessAgentFactory ?? harnessAgentFactory)(effectiveInput, {
        harness,
        instructions,
        skills,
    });
    let live: HarnessAgentSession | undefined;
    const instructionActivityKey = 'instructions';
    const grottoAgentVersionDrift = session.grottoAgentVersion !== grottoAgentVersion;
    let grottoAgentVersionCanApply = true;
    try {
        const sessionId = session.runtimeSessionId ?? `${input.agentId}-${session.generation}`;
        const resumeFrom =
            (session.resumeState as HarnessAgentResumeSessionState | null) ?? undefined;
        let effectiveResumeFrom = resumeFrom;
        let factoryGuidanceNotice: string | null = null;
        let factoryGuidanceRefreshPending =
            input.factoryKind === 'cove' && (await hasPendingCoveGuidanceRefresh(input.agentRoot));
        let factoryGuidanceRefreshCanComplete = factoryGuidanceRefreshPending;
        if (factoryGuidanceRefreshPending) {
            await input.activity.start({
                category: 'updating_instructions',
                key: instructionActivityKey,
            });
            factoryGuidanceNotice = coveGuidanceRefreshNotice;
        }
        if (input.factoryKind === 'cove') {
            const plan = await inspectCoveFactoryGuidance(input.workspaceDir);
            if (plan.kind !== 'current') {
                if (!input.activity.isActive(instructionActivityKey)) {
                    await input.activity.start({
                        category: 'updating_instructions',
                        key: instructionActivityKey,
                    });
                }
                if (plan.kind === 'conflict') {
                    await input.activity.finish(instructionActivityKey, 'failed');
                    grottoAgentVersionCanApply = false;
                    factoryGuidanceRefreshCanComplete = false;
                    factoryGuidanceNotice = coveGuidanceConflictNotice(plan.files);
                } else {
                    await markCoveGuidanceRefreshPending(input.agentRoot);
                    factoryGuidanceRefreshPending = true;
                    factoryGuidanceRefreshCanComplete = true;
                    const result = await reconcileCoveFactoryGuidance(input.workspaceDir);
                    if (result.kind !== 'conflict') {
                        factoryGuidanceNotice = coveGuidanceRefreshNotice;
                    } else {
                        await input.activity.finish(instructionActivityKey, 'failed');
                        grottoAgentVersionCanApply = false;
                        factoryGuidanceRefreshCanComplete = false;
                        factoryGuidanceNotice = coveGuidanceConflictNotice(
                            result.kind === 'conflict' ? result.files : plan.files
                        );
                    }
                }
            }
        }
        // Remove only an unresumable cold generation; successful sessions retain resume state.
        if (!(resumeFrom || session.runtimeSessionId)) {
            await rm(join(input.agentRoot, '.agent-runs', sessionId), {
                force: true,
                recursive: true,
            });
        }
        const instructionDrift = session.instructionFingerprint !== instructionFingerprint;
        const bootstrapDrift = session.bootstrapFingerprint !== bootstrapFingerprint;
        const refreshBootstrap = resumeFrom !== undefined && (restartRequested || bootstrapDrift);
        if (
            resumeFrom &&
            (restartRequested ||
                instructionDrift ||
                bootstrapDrift ||
                (grottoAgentVersionDrift && grottoAgentVersionCanApply)) &&
            !input.activity.isActive(instructionActivityKey)
        ) {
            await input.activity.start({
                category: 'updating_instructions',
                key: instructionActivityKey,
            });
        }
        if (resumeFrom && refreshBootstrap) {
            let parked: HarnessAgentSession;
            try {
                parked = await agent.createSession({
                    abortSignal: input.signal,
                    resumeFrom,
                    sessionId,
                });
            } catch (error) {
                throw new AgentSessionResumeRejectedError(input.agentId, { cause: error });
            }
            // Only creation rejection invalidates native resume state.
            const parkedState = await parked.stop();
            await harnessBootstrapRefresh({
                abortSignal: input.signal,
                harness,
                provider: createLocalTrustedSandboxProvider(sandboxOptions(input)),
                sessionId,
                workDir: basename(input.workspaceDir),
            });
            effectiveResumeFrom = parkedState;
        }
        // Startup phases cover wedges before the stream watchdog can observe an event.
        const phaseStartedAt = Date.now();
        const phase = (label: string) =>
            settle(
                input.runtime,
                Effect.logInfo('Harness turn reached a lifecycle phase.').pipe(
                    Effect.annotateLogs({
                        agentId: input.agentId,
                        elapsedSeconds: Math.round((Date.now() - phaseStartedAt) / 1000),
                        event: 'harness-turn-phase',
                        phase: label,
                        runtimeId: input.runtimeId,
                    })
                )
            );
        try {
            await phase(
                effectiveResumeFrom ? 'creating session (resume)' : 'creating session (cold)'
            );
            live = await agent.createSession({
                abortSignal: input.signal,
                resumeFrom: effectiveResumeFrom,
                sessionId,
            });
            await phase('session ready');
        } catch (error) {
            await phase('session creation failed');
            if (!resumeFrom) {
                throw error;
            }
            throw new AgentSessionResumeRejectedError(input.agentId, { cause: error });
        }

        const isColdStart = !live.isResume;
        const coldInbox = isColdStart
            ? input.inboxDelivery === 'concrete'
                ? composeInboxDrain(input.inbox, input.homeTimezone)
                : composeInboxNotice(input.inbox, input.totalPending)
            : null;
        const warmNotice =
            !isColdStart && input.inboxDelivery === 'notice'
                ? composeInboxNotice(input.inbox, input.totalPending)
                : null;
        const resetContext =
            session.generation === 1
                ? null
                : 'Fresh session: your previous conversation context is gone. Your workspace and MEMORY.md are intact — MEMORY.md is your recovery point.';
        const coldStart = resetContext ? `Start.\n${resetContext}` : 'Start.';
        const turnContent = isColdStart
            ? coldInbox
                ? [resetContext, coldInbox].filter(Boolean).join('\n\n')
                : coldStart
            : input.inboxDelivery === 'concrete'
              ? composeInboxDrain(input.inbox, input.homeTimezone)
              : (warmNotice ?? 'Resume the interrupted turn.');
        const turn = await agent.stream({
            abortSignal: input.signal,
            prompt: projectMessageForAgent({
                content: [factoryGuidanceNotice, turnContent].filter(Boolean).join('\n\n'),
                enabledSkillIds: skills.map((skill) => skill.name),
            }),
            session: live,
        });
        const deliverNotice = createNoticeDelivery(
            live,
            input.runtime,
            input.agentRoot,
            warmNotice ?? (input.inboxDelivery === 'notice' ? coldInbox : null)
        );
        const noticeCoordinator = createNoticeCoordinator(deliverNotice);
        const primaryNotice = warmNotice ?? (input.inboxDelivery === 'notice' ? coldInbox : null);
        const deliverAtSafeBoundary = async (notice: string) =>
            notice === primaryNotice
                ? await deliverNotice(notice)
                : await noticeCoordinator.enqueue(notice);
        const unregisterNoticeSink = input.registerNoticeSink?.(deliverAtSafeBoundary);
        const storedNoticeReady = Promise.withResolvers<void>();
        const storedNoticeDelivery = deliverStoredNotice(
            input.agentRoot,
            deliverAtSafeBoundary,
            input.onStoredNoticeDelivered,
            () => storedNoticeReady.resolve()
        );
        let observation: HarnessTurnResult;
        const projector = createHarnessActivityProjector({
            activity: input.activity,
            journal,
            runtimeId: input.runtimeId,
        });
        try {
            observation = await settle(
                input.runtime,
                input.activity.around(
                    Effect.tryPromise({
                        catch: (cause) => new HarnessStreamForeignError({ cause }),
                        try: async () => {
                            await storedNoticeReady.promise;
                            return await observeTurnStream(
                                turn.fullStream,
                                noticeCoordinator.flush,
                                projector,
                                {
                                    onFirstPart: () => phase('first stream event'),
                                    runtime: input.runtime,
                                    signal: input.signal,
                                    stallLabel: `${input.runtimeId} agent=${input.agentId}`,
                                }
                            );
                        },
                    }),
                    {
                        category: 'thinking',
                        key: 'thinking',
                        outcomeFromResult: (result) =>
                            result.aborted ? 'interrupted' : 'completed',
                    }
                ),
                { mapFailure: (failure) => failure.cause }
            );
            if (observation.claudePlanUsage) {
                await saveClaudePlanUsageSnapshot(
                    input.dataRoot,
                    observation.claudePlanUsage
                ).catch(() => undefined);
            }
        } catch (error) {
            await projector.finish(input.signal?.aborted ? 'interrupted' : 'failed', error);
            throw error;
        } finally {
            unregisterNoticeSink?.();
            noticeCoordinator.close();
            await storedNoticeDelivery;
        }
        // Detach parks the runtime so the next delivery reattaches to this Agent daemon.
        const resumeState = await live.detach();
        const normalizedUsage = normalizeRuntimeUsage(
            input.runtimeId,
            observation.tokenUsage,
            session.cumulativeTokenUsage
        );
        if (observation.aborted) {
            await writeAgentSessionState(input.agentRoot, {
                ...session,
                cumulativeTokenUsage: normalizedUsage.cumulative,
                grottoAgentStatus: grottoAgentVersionDrift ? 'failed' : session.grottoAgentStatus,
                resumeState: resumeState as Record<string, unknown>,
                runtimeSessionId: live.sessionId,
            });
            await input.activity.finish(instructionActivityKey, 'interrupted');
            return { ...observation, tokenUsage: normalizedUsage.turn };
        }
        const appliesGrottoAgentVersion = !grottoAgentVersionDrift || grottoAgentVersionCanApply;
        await writeAgentSessionState(input.agentRoot, {
            bootstrapFingerprint,
            cumulativeTokenUsage: normalizedUsage.cumulative,
            effectiveModel: { modelId: input.modelId, runtimeId: input.runtimeId },
            generation: session.generation,
            grottoAgentAppliedAt:
                grottoAgentVersionDrift && appliesGrottoAgentVersion
                    ? new Date().toISOString()
                    : session.grottoAgentAppliedAt,
            grottoAgentStatus: appliesGrottoAgentVersion ? 'current' : 'failed',
            grottoAgentVersion: appliesGrottoAgentVersion
                ? grottoAgentVersion
                : session.grottoAgentVersion,
            instructionFingerprint,
            resumeState: resumeState as Record<string, unknown>,
            runtimeSessionId: live.sessionId,
        });
        if (factoryGuidanceRefreshPending && factoryGuidanceRefreshCanComplete) {
            await clearPendingCoveGuidanceRefresh(input.agentRoot);
        }
        await input.activity.finish(instructionActivityKey, 'completed');
        return { ...observation, tokenUsage: normalizedUsage.turn };
    } catch (error) {
        await input.activity.finish(
            instructionActivityKey,
            input.signal?.aborted ? 'interrupted' : 'failed'
        );
        if (grottoAgentVersionDrift) {
            await writeAgentSessionState(input.agentRoot, {
                ...session,
                grottoAgentStatus: 'failed',
            });
        }
        await live?.destroy().catch(() => undefined);
        if (error instanceof HarnessTurnFailedError) {
            const normalizedUsage = normalizeRuntimeUsage(
                input.runtimeId,
                error.tokenUsage,
                session.cumulativeTokenUsage
            );
            throw new HarnessTurnFailedError(normalizedUsage.turn, { cause: error.cause });
        }
        throw error;
    }
}

const coveGuidanceRefreshNotice =
    "Grotto updated Cove's factory-managed onboarding guidance. Before acting on this request, re-read notes/onboarding_playbook.md and notes/onboarding_knowledge_faq.md. Their current action-card guidance supersedes earlier assumptions from this session.";

function coveGuidanceConflictNotice(files: readonly string[]): string {
    return `Grotto could not update Cove's factory-managed onboarding guidance because these files were changed or removed: ${files.join(', ')}. Do not overwrite them. Retrieve the relevant Grotto Manual topic before claiming a capability is unavailable.`;
}

async function hasPendingCoveGuidanceRefresh(agentRoot: string): Promise<boolean> {
    return await readFile(coveGuidanceRefreshReceiptPath(agentRoot))
        .then(() => true)
        .catch((error: unknown) => {
            if (isRecord(error) && error.code === 'ENOENT') {
                return false;
            }
            throw error;
        });
}

async function markCoveGuidanceRefreshPending(agentRoot: string): Promise<void> {
    const receiptPath = coveGuidanceRefreshReceiptPath(agentRoot);
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, '{"version":1}\n', { mode: 0o600 });
}

async function clearPendingCoveGuidanceRefresh(agentRoot: string): Promise<void> {
    await rm(coveGuidanceRefreshReceiptPath(agentRoot), { force: true });
}

function coveGuidanceRefreshReceiptPath(agentRoot: string): string {
    return join(agentRoot, 'runtime', 'cove-guidance-refresh.json');
}

async function deliverStoredNotice(
    agentRoot: string,
    deliver: (notice: string) => Promise<boolean>,
    onDelivered?: (receipt: StoredNoticeReceipt) => void,
    onReady?: () => void
) {
    try {
        const value = JSON.parse(await readFile(pendingNoticePath(agentRoot), 'utf8')) as {
            notice?: unknown;
            receipt?: unknown;
        };
        if (typeof value.notice === 'string') {
            const accepted = deliver(value.notice);
            onReady?.();
            if (!(await accepted)) {
                return;
            }
            const receipt = parseStoredNoticeReceipt(value.receipt);
            if (receipt) {
                onDelivered?.(receipt);
            }
        }
    } catch (cause) {
        if (!(isRecord(cause) && cause.code === 'ENOENT')) {
            throw cause;
        }
    } finally {
        onReady?.();
    }
}

function createNoticeCoordinator(deliver: (notice: string) => Promise<boolean>) {
    const pending: Array<{
        notice: string;
        resolve: (accepted: boolean) => void;
    }> = [];
    let closed = false;
    return {
        close() {
            closed = true;
            for (const entry of pending.splice(0)) {
                entry.resolve(false);
            }
        },
        enqueue(notice: string): Promise<boolean> {
            if (closed) {
                return Promise.resolve(false);
            }
            return new Promise((resolve) => pending.push({ notice, resolve }));
        },
        async flush() {
            const entries = pending.splice(0);
            for (const [index, entry] of entries.entries()) {
                try {
                    entry.resolve(await deliver(entry.notice));
                } catch (error) {
                    entry.resolve(false);
                    for (const remaining of entries.slice(index + 1)) {
                        remaining.resolve(false);
                    }
                    throw error;
                }
            }
        },
    };
}

function parseStoredNoticeReceipt(value: unknown): StoredNoticeReceipt | null {
    if (!(isRecord(value) && typeof value.runId === 'string' && Array.isArray(value.workIds))) {
        return null;
    }
    const workIds = value.workIds.filter((id): id is string => typeof id === 'string');
    return workIds.length === value.workIds.length ? { runId: value.runId, workIds } : null;
}

function pendingNoticePath(agentRoot: string) {
    return join(agentRoot, 'runtime', 'pending-notice.json');
}

/** Observes execution evidence and terminal state; durable replies leave through the CLI. */
async function observeTurnStream(
    stream: AsyncIterable<unknown>,
    onToolBoundary: (() => Promise<void>) | undefined,
    projector: ReturnType<typeof createComputerActivityProjector> | undefined,
    {
        onFirstPart,
        runtime,
        signal,
        stallLabel,
        stallAfterMs = 120_000,
    }: {
        onFirstPart?: () => void | Promise<void>;
        runtime: DaemonRuntime;
        signal?: AbortSignal;
        stallAfterMs?: number;
        stallLabel?: string;
    }
): Promise<HarnessTurnResult> {
    let contextTokens: number | null = null;
    let finalTokenUsage: HarnessTokenUsage | null = null;
    let claudePlanUsage: ClaudeUsageSnapshot | null = null;
    let stepTokenUsage: HarnessTokenUsage | null = null;
    let streamError: unknown;
    let aborted = false;
    // Last-part timing distinguishes provider silence from a bridge that never emitted.
    let lastPartAt = Date.now();
    let lastPartType = 'none yet';
    let partCount = 0;
    const consume = Stream.fromAsyncIterable(
        stream,
        (cause) => new HarnessStreamForeignError({ cause })
    ).pipe(
        Stream.runForEach((part) =>
            Effect.tryPromise({
                catch: (cause) => new HarnessStreamForeignError({ cause }),
                try: async () => {
                    if (!isRecord(part) || typeof part.type !== 'string') {
                        return;
                    }
                    lastPartAt = Date.now();
                    lastPartType = part.type;
                    partCount += 1;
                    if (partCount === 1) {
                        await onFirstPart?.();
                    }
                    switch (part.type) {
                        case 'tool-call':
                        case 'file-change':
                            await projector?.observe(part);
                            return;
                        case 'tool-result':
                            await projector?.observe(part);
                            if (part.preliminary !== true) {
                                await onToolBoundary?.();
                            }
                            return;
                        case 'finish-step':
                            contextTokens = usageContextTokens(part.usage) ?? contextTokens;
                            stepTokenUsage = addTokenUsage(
                                stepTokenUsage,
                                readTokenUsage(part.usage)
                            );
                            return;
                        case 'finish':
                            contextTokens = usageContextTokens(part.totalUsage) ?? contextTokens;
                            finalTokenUsage = readTokenUsage(part.totalUsage);
                            claudePlanUsage = readClaudePlanUsageMetadata(part.providerMetadata);
                            return;
                        case 'error':
                            streamError ??= part.error ?? new Error('Harness stream failed.');
                            return;
                        case 'abort':
                            aborted = true;
                            return;
                        default:
                            return;
                    }
                },
            })
        ),
        Effect.catchAll((failure) =>
            Effect.sync(() => {
                streamError ??= failure.cause;
            })
        )
    );
    const watchdog = Effect.sleep('60 seconds').pipe(
        Effect.andThen(
            Effect.sync(() => Date.now() - lastPartAt).pipe(
                Effect.flatMap((silentForMs) =>
                    stallLabel && silentForMs >= stallAfterMs
                        ? Effect.logWarning('Harness turn stream stalled.').pipe(
                              Effect.annotateLogs({
                                  event: 'harness-turn-stream-stalled',
                                  eventCount: partCount,
                                  lastEventType: lastPartType,
                                  silentSeconds: Math.round(silentForMs / 1000),
                                  stallLabel,
                              })
                          )
                        : Effect.void
                )
            )
        ),
        Effect.forever
    );
    const program = Effect.scoped(
        Effect.gen(function* () {
            if (stallLabel) {
                yield* Effect.forkScoped(watchdog);
            }
            yield* consume;
            const tokenUsage = finalTokenUsage ?? stepTokenUsage;
            if (aborted) {
                yield* finishProjector(projector, 'interrupted', streamError);
                return { aborted: true, claudePlanUsage, contextTokens, tokenUsage };
            }
            if (streamError) {
                yield* finishProjector(projector, 'failed', streamError);
                return yield* Effect.fail(
                    new HarnessTurnFailedError(tokenUsage, { cause: streamError })
                );
            }
            yield* finishProjector(projector, 'completed');
            return { aborted: false, claudePlanUsage, contextTokens, tokenUsage };
        })
    ).pipe(
        Effect.onInterrupt(() =>
            finishProjector(projector, 'interrupted', streamError).pipe(Effect.ignore)
        )
    );
    return await settle(runtime, program, {
        mapFailure: (failure) =>
            failure instanceof HarnessStreamForeignError ? failure.cause : failure,
        onInterrupted: () => ({
            aborted: true,
            claudePlanUsage,
            contextTokens,
            tokenUsage: finalTokenUsage ?? stepTokenUsage,
        }),
        signal,
    });
}

function finishProjector(
    projector: ReturnType<typeof createComputerActivityProjector> | undefined,
    phase: 'completed' | 'failed' | 'interrupted',
    error?: unknown
) {
    return Effect.tryPromise({
        catch: (cause) => new HarnessStreamForeignError({ cause }),
        try: () => projector?.finish(phase, error) ?? Promise.resolve(),
    });
}

function readClaudePlanUsageMetadata(value: unknown): ClaudeUsageSnapshot | null {
    if (!isRecord(value)) {
        return null;
    }
    const claude = value['claude-code'];
    if (!(isRecord(claude) && isRecord(claude.planUsage))) {
        return null;
    }
    const usage = claude.planUsage;
    if (usage.rate_limits_available !== true || !isRecord(usage.rate_limits)) {
        return null;
    }
    try {
        return normalizeClaudeUsageResponse(usage.rate_limits, {
            source: 'claude-code-sdk-usage',
            subscriptionType:
                typeof usage.subscription_type === 'string' ? usage.subscription_type : null,
        });
    } catch {
        return null;
    }
}

// Tests inject a fake Agent at this construction seam.
export type HarnessAgentFactory = (
    input: HarnessTurnInput,
    options: { harness: HarnessV1<ToolSet>; instructions: string; skills: HarnessAgentSkill[] }
) => Pick<HarnessAgent, 'createSession' | 'stream'>;

let harnessAgentFactory: HarnessAgentFactory = createHarnessAgent;

export function setHarnessAgentFactoryForTesting(factory: HarnessAgentFactory) {
    const previous = harnessAgentFactory;
    harnessAgentFactory = factory;
    return () => {
        harnessAgentFactory = previous;
    };
}

type HarnessBootstrapRefresh = typeof refreshHarnessBootstrap;

let harnessBootstrapRefresh: HarnessBootstrapRefresh = refreshHarnessBootstrap;

export function setHarnessBootstrapRefreshForTesting(refresh: HarnessBootstrapRefresh) {
    const previous = harnessBootstrapRefresh;
    harnessBootstrapRefresh = refresh;
    return () => {
        harnessBootstrapRefresh = previous;
    };
}

function createHarnessAgent(
    input: HarnessTurnInput,
    options: { harness: HarnessV1<ToolSet>; instructions: string; skills: HarnessAgentSkill[] }
): HarnessAgent {
    return new HarnessAgent({
        harness: options.harness,
        id: input.agentId,
        ...(input.runtimeId === 'claude-code'
            ? {
                  inactiveTools:
                      input.webAccess !== null ? ['webFetch'] : ['webSearch', 'webFetch'],
              }
            : {}),
        instructions: options.instructions,
        permissionMode: 'allow-all',
        sandbox: createLocalTrustedSandboxProvider(sandboxOptions(input)),
        // Anchor at the parent so the workDir remains visible to workspace browsing.
        sandboxConfig: { workDir: basename(input.workspaceDir) },
        skills: options.skills,
        tools: input.tools,
    });
}

function sandboxOptions(input: HarnessTurnInput) {
    const rootDir = dirname(input.workspaceDir);
    const profile = authProfileFor(input.runtimeId);
    if (input.runtimeId === 'grok-build') {
        return {
            authProfiles: ['grok-build'] as const,
            env: {
                ...input.env,
                GROK_HOME: join(input.homeDir, '.grok'),
                HOME: input.homeDir,
            },
            homeDir: input.homeDir,
            rootDir,
            runtime: input.runtime,
        };
    }
    if (input.runtimeId !== 'codex') {
        return {
            ...(profile ? { authProfiles: [profile] as const } : {}),
            env: { ...input.env, HOME: input.homeDir },
            homeDir: input.homeDir,
            rootDir,
            runtime: input.runtime,
        };
    }
    // Isolated CODEX_HOME reuses host login without leaking cross-Agent sessions.
    return {
        authProfiles: ['codex'] as const,
        env: {
            ...input.env,
            CODEX_HOME: join(input.homeDir, '.codex'),
            HOME: input.homeDir,
        },
        homeDir: input.homeDir,
        rootDir,
        runtime: input.runtime,
    };
}

function authProfileFor(runtimeId: string) {
    if (
        runtimeId === 'claude-code' ||
        runtimeId === 'codex' ||
        runtimeId === 'grok-build' ||
        runtimeId === 'pi'
    ) {
        return runtimeId;
    }
    return null;
}

/** Machine-wide immutable package store; Agent state remains isolated. */
function bridgeStoreDir() {
    return bridgeStoreDirForHost();
}

function createHarnessForRuntime(
    runtimeId: string,
    modelId: string,
    reasoningEffort: AgentReasoningEffort,
    webAccess = false,
    storeDir?: string
): HarnessV1<ToolSet> {
    switch (runtimeId) {
        case 'claude-code':
            return withComputerBridgeBootstrap(
                createClaudeCode({
                    // CLI-only output makes every send/check a tool call, so turns
                    // legitimately run long tool loops.
                    maxTurns: 50,
                    model: modelId,
                    effort: reasoningEffort,
                }),
                'claude-code',
                { storeDir }
            ) as HarnessV1<ToolSet>;
        case 'codex':
            return withComputerBridgeBootstrap(
                createCodex({
                    model: modelId,
                    reasoningEffort,
                    ...(webAccess ? { webSearch: true } : {}),
                }),
                'codex',
                { storeDir }
            ) as HarnessV1<ToolSet>;
        case 'grok-build':
            return createGrokBuild({ model: modelId }) as HarnessV1<ToolSet>;
        case 'pi':
            return createPi({
                model: modelId,
                thinkingLevel: reasoningEffort,
            }) as HarnessV1<ToolSet>;
        default:
            throw new Error(`Unsupported runtime "${runtimeId}".`);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
