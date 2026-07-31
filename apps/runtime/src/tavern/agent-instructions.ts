import { createHash } from 'node:crypto';
import type { AgentRuntimeAgentSession } from '@tavern/api';
import { prepareAgentEngineInstructions } from '../agent-engine/instructions.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import type { AgentRuntimeContextFacts } from '../workspace/instructions.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { readAgentSessionInstructionsHash } from './agent-session-store.ts';
import { getStoredAgent } from './agents-store.ts';

// PROMPT CONTRACT: this module composes every agent's system prompt. Text
// changes must pass agent-prompt-contract.test.ts and need explicit operator
// approval for any removed capability or raised budget. See AGENTS.md
// ("Agent System Prompt Changes").

export interface BuildAgentInstructionOptions {
    db?: Database;
    runtimeContext?: AgentRuntimeContextFacts;
    seedSkills?: boolean;
    skillsDir?: string;
}

// The subset of executor input that instruction composition reads. One
// global session spans chats, so instructions are agent-scoped: per-turn
// deliveries carry their own targets (harness-prompt.ts).
export type AgentInstructionContext = Pick<AgentExecutorInput, 'agent' | 'agentSession'>;

export async function buildAgentInstructions(
    input: AgentInstructionContext,
    options: BuildAgentInstructionOptions = {}
) {
    return (await buildAgentInstructionBundle(input, options)).instructions;
}

// Instructions plus a freshness fingerprint. Harness adapters deliver
// instructions once per session (first prompt), so the fingerprint lets the
// session read report whether a live session started on current instructions.
// The prompt is near-deterministic per agent (D7): the composed text IS the
// fingerprint input.
export async function buildAgentInstructionBundle(
    input: AgentInstructionContext,
    options: BuildAgentInstructionOptions = {}
) {
    const prepared = await prepareAgentEngineInstructions(options.db ?? getDb(), input.agent, {
        model: input.agentSession.effectiveModel,
        runtimeContext: options.runtimeContext,
        seedSkills: options.seedSkills,
        skillsDir: options.skillsDir,
    });
    const instructions = prepared.content;
    const fingerprint = createHash('sha256').update(instructions).digest('hex');
    return { fingerprint, instructions };
}

/**
 * Whether the session's delivered instructions still match a fresh compose.
 * Null when the session has not delivered instructions yet (fresh by
 * construction) or the agent record is gone.
 */
export async function agentSessionInstructionsFresh(
    session: AgentRuntimeAgentSession,
    options: BuildAgentInstructionOptions = {}
): Promise<boolean | null> {
    const deliveredHash = readAgentSessionInstructionsHash(session.id, options.db);
    if (!deliveredHash) {
        return null;
    }
    const agent = getStoredAgent(session.agentId, options.db);
    if (!agent) {
        return null;
    }
    const bundle = await buildAgentInstructionBundle(
        { agent, agentSession: session },
        { ...options, seedSkills: false }
    );
    return bundle.fingerprint === deliveredHash;
}
