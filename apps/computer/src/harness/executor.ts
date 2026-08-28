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
import type { ComputerAgentActivityUpdate } from '../agent-activity.ts';
import type { StoredNoticeReceipt } from '../delivery.ts';
import { composeInboxDrain, composeInboxNotice } from '../inbox-format.ts';
import type { AgentInboxItem } from '../launch.ts';
import {
    claimClaudeSdkUsageRefresh,
    saveClaudePlanUsageSnapshot,
} from '../usage/claude-plan-usage-state.ts';
import {
    createComputerActivityProjector,
    createComputerActivityRegistry,
} from './activity-projector.ts';
import { fingerprintHarnessBootstrap, refreshHarnessBootstrap } from './bootstrap-refresh.ts';
import { bridgeStoreDirForAgentsRoot, withComputerBridgeBootstrap } from './bridge-bootstrap.ts';
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
    type AgentSessionTokenUsage,
    readAgentSessionState,
    resolveTurnSession,
    writeAgentSessionState,
} from './session-store.ts';
import { readAgentSkills } from './skills.ts';

/**
 * A ported copy of Runtime's `harness-agent-executor.ts`, adapted to the
 * Computer's launch boundary. It drives the real `@ai-sdk/harness` Codex, Claude
 * Code, Grok Build, and Pi adapters for one Agent turn: an isolated
 * workspace/HOME/skills, native host provider login (the sandbox seeds the machine's own session), the
 * managed `grotto` wrapper as the sole output channel, the ported Grotto
 * operating/system prompt (`instructions.ts`) composed per turn and delivered
 * once on cold start, and the Agent's one global persistent session resumed
 * across turns. Runtime-owned boundaries not available here — credential
 * injection (native host login replaces it), telemetry, and composition
 * publishing — are dropped or replaced.
 */
export interface HarnessTurnInput {
    agentId: string;
    /** The Agent handle: `@agentName` and the identity/mention sections. */
    agentName: string;
    /** The Agent's local partition root: `<serverId>/agents/<agentId>`. */
    agentRoot: string;
    dataRoot: string;
    /** Sandbox env: `grotto` on PATH, proxy/MCP identity, HOME. */
    env: Record<string, string>;
    factoryKind: 'cove' | 'ordinary';
    homeDir: string;
    /** Home timezone for the Current Runtime Context section. */
    homeTimezone: string;
    /** Structured Server-owned inbox rows. Computer owns their model projection. */
    inbox: AgentInboxItem[];
    inboxDelivery: 'concrete' | 'notice';
    /** The Agent's description — the personality surface (ruling W2). */
    initialRole: string | null;
    modelId: string;
    onActivity?: (activity: ComputerAgentActivityUpdate) => void;
    onStoredNoticeDelivered?: (receipt: StoredNoticeReceipt) => void;
    reasoningEffort: AgentReasoningEffort;
    registerNoticeSink?: NoticeSinkRegistrar;
    runId: string;
    runtimeId: string;
    sessionGeneration: number;
    signal?: AbortSignal;
    skillsDir: string;
    /** Runtime's grant-filtered MCP tools, now composed by Computer. */
    tools: ToolSet;
    totalPending: number;
    /** Resolved web-access variant, or null when off. */
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

export type HarnessTokenUsage = AgentSessionTokenUsage;

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

export async function runHarnessTurn(input: HarnessTurnInput): Promise<HarnessTurnResult> {
    const journal = await createComputerExecutionJournal({
        agentRoot: input.agentRoot,
        runId: input.runId,
    });
    try {
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
        await journal.finish(result.aborted ? 'interrupted' : 'completed');
        return result;
    } catch (error) {
        await journal.finish(input.signal?.aborted ? 'interrupted' : 'failed', error);
        throw error;
    }
}

async function executeHarnessTurn(
    input: HarnessTurnInput,
    session: AgentSessionState,
    restartRequested: boolean,
    journal: ComputerExecutionJournal
): Promise<HarnessTurnResult> {
    const skills = await readAgentSkills(input.skillsDir);
    // The Computer composes the managed Grotto operating contract itself. A
    // changed fingerprint restarts the adapter boundary before this turn while
    // preserving the native conversation.
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
        bridgeStoreDir(input)
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
    const agent = harnessAgentFactory(effectiveInput, { harness, instructions, skills });
    let live: HarnessAgentSession | undefined;
    let instructionUpdate: 'completed' | 'none' | 'started' = 'none';
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
            input.onActivity?.({ category: 'updating_instructions', phase: 'started' });
            instructionUpdate = 'started';
            factoryGuidanceNotice = coveGuidanceRefreshNotice;
        }
        if (input.factoryKind === 'cove') {
            const plan = await inspectCoveFactoryGuidance(input.workspaceDir);
            if (plan.kind !== 'current') {
                if (instructionUpdate === 'none') {
                    input.onActivity?.({ category: 'updating_instructions', phase: 'started' });
                }
                if (plan.kind === 'conflict') {
                    input.onActivity?.({ category: 'updating_instructions', phase: 'failed' });
                    instructionUpdate = 'none';
                    grottoAgentVersionCanApply = false;
                    factoryGuidanceRefreshCanComplete = false;
                    factoryGuidanceNotice = coveGuidanceConflictNotice(plan.files);
                } else {
                    instructionUpdate = 'started';
                    await markCoveGuidanceRefreshPending(input.agentRoot);
                    factoryGuidanceRefreshPending = true;
                    factoryGuidanceRefreshCanComplete = true;
                    const result = await reconcileCoveFactoryGuidance(input.workspaceDir);
                    if (result.kind !== 'conflict') {
                        factoryGuidanceNotice = coveGuidanceRefreshNotice;
                    } else {
                        input.onActivity?.({ category: 'updating_instructions', phase: 'failed' });
                        instructionUpdate = 'none';
                        grottoAgentVersionCanApply = false;
                        factoryGuidanceRefreshCanComplete = false;
                        factoryGuidanceNotice = coveGuidanceConflictNotice(
                            result.kind === 'conflict' ? result.files : plan.files
                        );
                    }
                }
            }
        }
        // Unlike Runtime's DB-issued session ids, Computer derives its cold id
        // from the durable generation. A failed/interrupted cold start can leave
        // an unresumable harness run directory behind; remove only that exact
        // cold directory so the next attempt installs the current bridge and
        // starts clean. Successful sessions persist resume state and skip this.
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
            instructionUpdate === 'none'
        ) {
            input.onActivity?.({ category: 'updating_instructions', phase: 'started' });
            instructionUpdate = 'started';
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
            // Only creation rejection proves the native resume state is bad.
            // Parking or bootstrap I/O failures leave this generation intact so
            // a later delivery can retry the idempotent refresh.
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
        // Wedge attribution: a turn stuck before its first stream event is
        // invisible to the stream watchdog, so the startup path logs its own
        // phases with timings.
        const phaseStartedAt = Date.now();
        const phase = (label: string) =>
            console.error(
                `[turn-phase] ${input.runtimeId} agent=${input.agentId} ${label} (${Math.round((Date.now() - phaseStartedAt) / 1000)}s)`
            );
        try {
            phase(effectiveResumeFrom ? 'creating session (resume)' : 'creating session (cold)');
            live = await agent.createSession({
                abortSignal: input.signal,
                resumeFrom: effectiveResumeFrom,
                sessionId,
            });
            phase('session ready');
        } catch (error) {
            phase('session creation failed');
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
        const activityRegistry = createComputerActivityRegistry();
        activityRegistry.registerGrottoHostTool({
            category: 'browsing',
            name: 'browser',
            toolRef: 'browser',
        });
        activityRegistry.registerGrottoHostTool({
            category: 'browsing',
            name: 'web_fetch',
            toolRef: 'web-fetch',
        });
        const projector = createComputerActivityProjector({
            journal,
            onActivity: input.onActivity,
            registry: activityRegistry,
            runtimeId: input.runtimeId,
        });
        input.onActivity?.({ category: 'thinking', phase: 'started' });
        try {
            await storedNoticeReady.promise;
            observation = await observeTurnStream(
                turn.fullStream,
                noticeCoordinator.flush,
                projector,
                {
                    onFirstPart: () => phase('first stream event'),
                    stallLabel: `${input.runtimeId} agent=${input.agentId}`,
                }
            );
            if (observation.claudePlanUsage) {
                await saveClaudePlanUsageSnapshot(
                    input.dataRoot,
                    observation.claudePlanUsage
                ).catch(() => undefined);
            }
            input.onActivity?.({
                category: 'thinking',
                phase: observation.aborted ? 'failed' : 'completed',
            });
        } catch (error) {
            await projector.finish(input.signal?.aborted ? 'interrupted' : 'failed', error);
            input.onActivity?.({ category: 'thinking', phase: 'failed' });
            throw error;
        } finally {
            unregisterNoticeSink?.();
            noticeCoordinator.close();
            await storedNoticeDelivery;
        }
        // Detach parks the Harness session while leaving its underlying runtime
        // process alive. The next delivery reattaches to this same per-Agent
        // daemon instead of cold-spawning a new runtime.
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
            if (instructionUpdate === 'started') {
                instructionUpdate = 'none';
                input.onActivity?.({ category: 'updating_instructions', phase: 'failed' });
            }
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
        if (instructionUpdate === 'started') {
            instructionUpdate = 'completed';
            input.onActivity?.({ category: 'updating_instructions', phase: 'completed' });
        }
        return { ...observation, tokenUsage: normalizedUsage.turn };
    } catch (error) {
        if (instructionUpdate === 'started') {
            input.onActivity?.({ category: 'updating_instructions', phase: 'failed' });
        }
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
    "Grotto updated Cove's factory-managed onboarding guidance. Before acting on this request, re-read onboarding_playbook.md and onboarding_knowledge_faq.md. Their current action-card guidance supersedes earlier assumptions from this session.";

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

function createNoticeDelivery(
    session: HarnessAgentSession,
    agentRoot: string,
    alreadyVisible: string | null = null
) {
    let lastDelivered: string | null = alreadyVisible;
    return async (notice: string) => {
        if (!notice.trim()) {
            return false;
        }
        if (notice !== lastDelivered && !(await storedNoticeMatches(agentRoot, notice))) {
            return false;
        }
        const accepted = notice === lastDelivered || (await session.sendUserMessage(notice));
        if (accepted) {
            lastDelivered = notice;
            await clearStoredNoticeIfMatching(agentRoot, notice);
        }
        return accepted;
    };
}

async function storedNoticeMatches(agentRoot: string, notice: string): Promise<boolean> {
    try {
        const value = JSON.parse(await readFile(pendingNoticePath(agentRoot), 'utf8')) as {
            notice?: unknown;
        };
        return value.notice === notice;
    } catch (cause) {
        if (isRecord(cause) && cause.code === 'ENOENT') {
            return false;
        }
        throw cause;
    }
}

async function clearStoredNoticeIfMatching(agentRoot: string, notice: string) {
    const path = pendingNoticePath(agentRoot);
    try {
        const value = JSON.parse(await readFile(path, 'utf8')) as { notice?: unknown };
        if (value.notice === notice) {
            await rm(path, { force: true });
        }
    } catch (cause) {
        if (!(isRecord(cause) && cause.code === 'ENOENT')) {
            throw cause;
        }
    }
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

/**
 * Watches the turn's stream for its context-size fact and terminal state. With
 * CLI-only output the stream is execution evidence, not chat content — the
 * durable reply left through `grotto message send`. A simplified port of
 * Runtime's `harness-stream-observer.ts` with the composition wiring dropped.
 */
async function observeTurnStream(
    stream: AsyncIterable<unknown>,
    onToolBoundary?: () => Promise<void>,
    projector?: ReturnType<typeof createComputerActivityProjector>,
    {
        onFirstPart,
        stallLabel,
        stallAfterMs = 120_000,
    }: { onFirstPart?: () => void; stallAfterMs?: number; stallLabel?: string } = {}
): Promise<HarnessTurnResult> {
    let contextTokens: number | null = null;
    let finalTokenUsage: HarnessTokenUsage | null = null;
    let claudePlanUsage: ClaudeUsageSnapshot | null = null;
    let stepTokenUsage: HarnessTokenUsage | null = null;
    let streamError: unknown;
    let aborted = false;
    // Wedge telemetry: long silences separate provider latency (events flowed,
    // then stopped after a known part) from a hung bridge (nothing ever came).
    let lastPartAt = Date.now();
    let lastPartType = 'none yet';
    let partCount = 0;
    const stallTimer = stallLabel
        ? setInterval(() => {
              const silentForMs = Date.now() - lastPartAt;
              if (silentForMs >= stallAfterMs) {
                  console.error(
                      `[harness-stall] ${stallLabel}: no stream events for ${Math.round(silentForMs / 1000)}s (${partCount} events so far, last: ${lastPartType})`
                  );
              }
          }, 60_000)
        : null;
    stallTimer?.unref?.();
    try {
        for await (const part of stream) {
            if (!isRecord(part) || typeof part.type !== 'string') {
                continue;
            }
            lastPartAt = Date.now();
            lastPartType = part.type;
            partCount += 1;
            if (partCount === 1) {
                onFirstPart?.();
            }
            switch (part.type) {
                case 'tool-call':
                    await projector?.observe(part);
                    break;
                case 'tool-result':
                    await projector?.observe(part);
                    if (part.preliminary !== true) {
                        await onToolBoundary?.();
                    }
                    break;
                case 'file-change':
                    await projector?.observe(part);
                    break;
                case 'finish-step':
                    contextTokens = usageContextTokens(part.usage) ?? contextTokens;
                    stepTokenUsage = addTokenUsage(stepTokenUsage, readTokenUsage(part.usage));
                    break;
                case 'finish':
                    contextTokens = usageContextTokens(part.totalUsage) ?? contextTokens;
                    finalTokenUsage = readTokenUsage(part.totalUsage);
                    claudePlanUsage = readClaudePlanUsageMetadata(part.providerMetadata);
                    break;
                case 'error':
                    streamError ??=
                        (part as { error?: unknown }).error ?? new Error('Harness stream failed.');
                    break;
                case 'abort':
                    aborted = true;
                    break;
                default:
                    break;
            }
        }
    } catch (error) {
        streamError ??= error;
    } finally {
        if (stallTimer) {
            clearInterval(stallTimer);
        }
    }
    if (aborted) {
        await projector?.finish('interrupted', streamError);
        return {
            aborted: true,
            claudePlanUsage,
            contextTokens,
            tokenUsage: finalTokenUsage ?? stepTokenUsage,
        };
    }
    if (streamError) {
        await projector?.finish('failed', streamError);
        throw new HarnessTurnFailedError(finalTokenUsage ?? stepTokenUsage, {
            cause: streamError,
        });
    }
    await projector?.finish('completed');
    return {
        aborted: false,
        claudePlanUsage,
        contextTokens,
        tokenUsage: finalTokenUsage ?? stepTokenUsage,
    };
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

// The construction seam. Tests inject a fake harness Agent to exercise the
// executor and CLI-reply path without a real model.
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
        // The session's work directory IS the workspace: the sandbox anchors at
        // the workspace parent and workDir names the workspace folder, so Agent
        // files stay visible to workspace browsing (Runtime parity).
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
        };
    }
    if (input.runtimeId !== 'codex') {
        return {
            ...(profile ? { authProfiles: [profile] as const } : {}),
            env: { ...input.env, HOME: input.homeDir },
            homeDir: input.homeDir,
            rootDir,
        };
    }
    // Codex reads auth + sessions from CODEX_HOME; keep it inside the isolated
    // HOME so the host's native login is reused without leaking cross-Agent.
    return {
        authProfiles: ['codex'] as const,
        env: {
            ...input.env,
            CODEX_HOME: join(input.homeDir, '.codex'),
            HOME: input.homeDir,
        },
        homeDir: input.homeDir,
        rootDir,
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

/**
 * Selects and configures the `@ai-sdk/harness` adapter by the Computer's own
 * runtime inventory ids, so what inventory advertises and what the Computer runs
 * never diverge. Provider authentication is the host's native login (seeded into
 * the sandbox HOME), so no credential is injected here.
 */
/**
 * One content-addressed pnpm store per Computer server tree, shared by every
 * Agent's bridge bootstrap: the runtime's platform binary downloads once
 * (pre-warmed at attach), and Agents hard-link from the store instead of
 * hitting the network.
 */
function bridgeStoreDir(input: HarnessTurnInput) {
    return bridgeStoreDirForAgentsRoot(dirname(dirname(input.workspaceDir)));
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

function usageContextTokens(usage: unknown): number | null {
    if (!isRecord(usage)) {
        return null;
    }
    const inputTotal = tokenCount(usage.inputTokens);
    const outputTotal = tokenCount(usage.outputTokens);
    if (inputTotal === null && outputTotal === null) {
        return null;
    }
    return (inputTotal ?? 0) + (outputTotal ?? 0);
}

function readTokenUsage(usage: unknown): HarnessTokenUsage | null {
    if (!isRecord(usage)) {
        return null;
    }
    const inputDetails = isRecord(usage.inputTokenDetails) ? usage.inputTokenDetails : null;
    const inputTokens = tokenCount(usage.inputTokens);
    const outputTokens = tokenCount(usage.outputTokens);
    const cacheReadTokens = tokenCount(inputDetails?.cacheReadTokens);
    const cacheWriteTokens = tokenCount(inputDetails?.cacheWriteTokens);
    if (
        inputTokens === null &&
        outputTokens === null &&
        cacheReadTokens === null &&
        cacheWriteTokens === null
    ) {
        return null;
    }
    return {
        cacheReadTokens: cacheReadTokens ?? 0,
        cacheWriteTokens: cacheWriteTokens ?? 0,
        inputTokens: inputTokens ?? 0,
        outputTokens: outputTokens ?? 0,
        totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
    };
}

function addTokenUsage(
    current: HarnessTokenUsage | null,
    next: HarnessTokenUsage | null
): HarnessTokenUsage | null {
    if (!next) {
        return current;
    }
    if (!current) {
        return next;
    }
    return {
        cacheReadTokens: current.cacheReadTokens + next.cacheReadTokens,
        cacheWriteTokens: current.cacheWriteTokens + next.cacheWriteTokens,
        inputTokens: current.inputTokens + next.inputTokens,
        outputTokens: current.outputTokens + next.outputTokens,
        totalTokens: current.totalTokens + next.totalTokens,
    };
}

function normalizeRuntimeUsage(
    runtimeId: string,
    observed: HarnessTokenUsage | null,
    previous: HarnessTokenUsage | null
): { cumulative: HarnessTokenUsage | null; turn: HarnessTokenUsage | null } {
    if (runtimeId !== 'codex' || observed === null) {
        return { cumulative: previous, turn: observed };
    }
    if (previous === null) {
        // Older Computer state predates the cumulative baseline. Seed it without
        // attributing the entire persistent Codex session to this one turn.
        return { cumulative: observed, turn: null };
    }
    const fields = tokenFields;
    const counterReset = fields.some((field) => observed[field] < previous[field]);
    if (counterReset) {
        return { cumulative: observed, turn: observed };
    }
    const turn = emptyTokenUsage();
    for (const field of fields) {
        turn[field] = observed[field] - previous[field];
    }
    turn.totalTokens = turn.inputTokens + turn.outputTokens;
    return { cumulative: observed, turn };
}

const tokenFields = ['cacheReadTokens', 'cacheWriteTokens', 'inputTokens', 'outputTokens'] as const;

function emptyTokenUsage(): HarnessTokenUsage {
    return {
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
    };
}

function tokenCount(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
