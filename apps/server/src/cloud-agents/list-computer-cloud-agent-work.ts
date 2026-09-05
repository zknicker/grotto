import type { CloudAgentReconcileEntry } from '@grotto/api';
import { and, eq, inArray } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { cloudAgentWorkTable } from '../postgres/schema.ts';
import { readRuns } from './cloud-agent-shape.ts';

/**
 * Every non-terminal work assigned to one Computer, with its newest Run and any
 * cancel request recorded while that Computer was offline. Reconnect pushes
 * this list down so the Computer reads each Run from the provider and reports
 * an observation: work that settled during the outage settles here too.
 */
export async function listComputerCloudAgentWork(
    db: GrottoDatabase,
    input: { computerId: string; serverId: string }
): Promise<CloudAgentReconcileEntry[]> {
    const rows = await db
        .select({
            cancelRequestedAt: cloudAgentWorkTable.cancelRequestedAt,
            id: cloudAgentWorkTable.id,
            provider: cloudAgentWorkTable.provider,
            providerAgentId: cloudAgentWorkTable.providerAgentId,
            status: cloudAgentWorkTable.status,
        })
        .from(cloudAgentWorkTable)
        .where(
            and(
                eq(cloudAgentWorkTable.serverId, input.serverId),
                eq(cloudAgentWorkTable.computerId, input.computerId),
                inArray(cloudAgentWorkTable.status, ['queued', 'running'])
            )
        )
        .limit(200);
    const runs = await readRuns(
        db,
        input.serverId,
        rows.map((row) => row.id)
    );
    return rows.flatMap((row) => {
        const run = runs.get(row.id)?.[0];
        if (!run || run.terminalAt) {
            return [];
        }
        return [
            {
                cancelRequested: row.cancelRequestedAt !== null,
                provider: row.provider,
                providerAgentId: row.providerAgentId,
                providerRunId: run.providerRunId,
                runId: run.id,
                status: row.status,
                workId: row.id,
            },
        ];
    });
}
