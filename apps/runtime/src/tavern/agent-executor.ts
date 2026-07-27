import type { AgentRuntimeAgent, AgentRuntimeAgentSession } from '@tavern/api';

// Floating turns (I1): a turn anchors to the agent's global session, never a
// chat. The runner composes the full per-turn prompt (Start. / drain
// delivery, ws2-turn-shapes.md) before execution; the executor only runs it.
// The agent's replies leave exclusively through `grotto message send` (D1) —
// an executor result carries no output messages.
export interface AgentExecutorInput {
    agent: AgentRuntimeAgent;
    /** The agent's global session (specs/sessions.md). */
    agentSession: AgentRuntimeAgentSession;
    prompt: string;
    runId: string;
}

export interface AgentExecutorResult {
    contextTokens: number | null;
}

/**
 * The executor could not resume the session's stored runtime state — it is
 * missing or the engine rejected replay. Runtime owns the response: it rotates
 * the agent session generation and cold-starts once (specs/sessions.md). The
 * executor never silently continues on a stale generation.
 */
export class AgentSessionResumeRejectedError extends Error {
    constructor(
        readonly agentSessionId: string,
        options?: { cause?: unknown }
    ) {
        super(
            `Agent session ${agentSessionId} could not resume its stored runtime state.`,
            options
        );
        this.name = 'AgentSessionResumeRejectedError';
    }
}

export interface AgentExecutor {
    /**
     * Deliver a user-visible text into a running turn's engine session.
     * Resolves true only when the engine accepted it; false means the turn
     * is not running or the engine has no mid-turn input, and the pending
     * rows wait for the next drain (I2).
     */
    deliverUserMessage?(runId: string, text: string): Promise<boolean> | boolean;
    execute(input: AgentExecutorInput): Promise<AgentExecutorResult>;
    stop?(runId: string): Promise<boolean> | boolean;
}
