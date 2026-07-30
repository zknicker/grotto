import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * One global persistent session per Agent (ADR 0011/0019), stored Computer-local
 * under the Agent's partition — the Computer's equivalent of Runtime's
 * `agent_sessions` table. The engine `runtimeSessionId` + opaque `resumeState`
 * are what let the next turn resume the same context; `effectiveModel` is fixed
 * at session start, so a runtime/model change rotates the generation and the
 * next turn cold-starts (specs/sessions.md).
 */
export interface AgentSessionState {
    effectiveModel: { modelId: string; runtimeId: string };
    generation: number;
    resumeState: Record<string, unknown> | null;
    runtimeSessionId: string | null;
}

const sessionFileName = 'session.json';

export async function readAgentSessionState(agentRoot: string): Promise<AgentSessionState | null> {
    try {
        const raw = await readFile(join(agentRoot, sessionFileName), 'utf8');
        const parsed = JSON.parse(raw) as AgentSessionState;
        if (
            typeof parsed.generation === 'number' &&
            typeof parsed.effectiveModel?.modelId === 'string' &&
            typeof parsed.effectiveModel?.runtimeId === 'string'
        ) {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

export async function writeAgentSessionState(
    agentRoot: string,
    state: AgentSessionState
): Promise<void> {
    // Atomic temporary-write-and-rename, matching the Computer's other small
    // records (ADR 0019): a crash mid-write never leaves a torn session file.
    const destination = join(agentRoot, sessionFileName);
    const temporary = `${destination}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
}

/**
 * Resolves the session this turn runs against. A fresh Agent, or one whose
 * stored `effectiveModel` no longer matches the assigned runtime/model, starts a
 * new generation with no resume state (cold start); otherwise the current
 * generation resumes.
 */
export function resolveTurnSession(
    stored: AgentSessionState | null,
    assigned: { generation: number; modelId: string; runtimeId: string }
): AgentSessionState {
    const modelChanged =
        stored !== null &&
        (stored.effectiveModel.runtimeId !== assigned.runtimeId ||
            stored.effectiveModel.modelId !== assigned.modelId);
    if (stored === null || modelChanged || stored.generation !== assigned.generation) {
        return {
            effectiveModel: { modelId: assigned.modelId, runtimeId: assigned.runtimeId },
            generation: assigned.generation,
            resumeState: null,
            runtimeSessionId: null,
        };
    }
    return stored;
}
