import type { AgentStartCommand, AgentTurnFrame } from './launch.ts';

/** Produces the terminal frame required when launch fails before the runtime reports. */
export function launchCrashTurn(
    command: AgentStartCommand,
    startedAt: string,
    error: unknown
): AgentTurnFrame {
    return {
        activity: { operations: [] },
        agentId: command.agentId,
        endedAt: new Date().toISOString(),
        messageCount: 0,
        modelId: command.modelId,
        outputProduced: false,
        runId: command.runId,
        runtimeId: command.runtimeId,
        startedAt,
        status: 'failed',
        summary: `The Agent launch failed: ${error instanceof Error ? error.message : String(error)}`,
        tokenUsage: null,
        type: 'turn',
        visibleMessages: [],
    };
}
