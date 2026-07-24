import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';

export async function auditMcpToolCall<Result>(
    input: {
        agentId: string;
        connectionId: string;
        toolName: string;
        turnId: string;
    },
    run: () => Promise<Result>
) {
    const callId = randomUUID();
    const startedAt = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO mcp_tool_audit
             (call_id, agent_id, turn_id, connection_id, tool_name, started_at, outcome)
             VALUES ($callId, $agentId, $turnId, $connectionId, $toolName, $startedAt, 'running')`
        )
        .run(namedParams({ callId, startedAt, ...input }));
    try {
        const result = await run();
        if (isMcpToolErrorResult(result)) {
            completeAudit(callId, 'failed', 'McpToolError');
        } else {
            completeAudit(callId, 'succeeded', null);
        }
        return result;
    } catch (error) {
        completeAudit(callId, 'failed', auditErrorType(error));
        throw error;
    }
}

export function auditErrorType(error: unknown) {
    return error instanceof Error && error.name ? error.name.slice(0, 100) : 'UnknownError';
}

function completeAudit(callId: string, outcome: 'failed' | 'succeeded', error: string | null) {
    getDb()
        .prepare(
            `UPDATE mcp_tool_audit
             SET completed_at = $completedAt, outcome = $outcome, error = $error
             WHERE call_id = $callId`
        )
        .run(
            namedParams({
                callId,
                completedAt: new Date().toISOString(),
                error,
                outcome,
            })
        );
}

function isMcpToolErrorResult(value: unknown) {
    return (
        typeof value === 'object' && value !== null && 'isError' in value && value.isError === true
    );
}
