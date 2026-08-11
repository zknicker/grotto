import type {
    HostedAgentActiveActivitySnapshot,
    HostedAgentActivityEvent,
    HostedAgentActivityHistoryInput,
    HostedAgentActivityHistoryPage,
} from '@tavern/api';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentActivityTable, agentDeliveryTable } from '../postgres/schema.ts';

export async function listHostedAgentActivityHistory(
    db: GrottoDatabase,
    input: HostedAgentActivityHistoryInput
): Promise<HostedAgentActivityHistoryPage> {
    const predicates = [
        eq(agentActivityTable.serverId, input.serverId),
        eq(agentActivityTable.agentId, input.agentId),
    ];
    if (input.runId) {
        predicates.push(eq(agentActivityTable.runId, input.runId));
    }
    if (input.before) {
        let beforeRunOrder: number | undefined;
        if (!input.runId) {
            const [cursorRun] = await db
                .select({ runOrder: agentActivityTable.runOrder })
                .from(agentActivityTable)
                .where(
                    and(
                        eq(agentActivityTable.serverId, input.serverId),
                        eq(agentActivityTable.agentId, input.agentId),
                        eq(agentActivityTable.runId, input.before.runId)
                    )
                )
                .limit(1);
            beforeRunOrder = cursorRun?.runOrder;
        }
        predicates.push(
            input.runId
                ? lt(agentActivityTable.position, input.before.position)
                : beforeRunOrder === undefined
                  ? sql`false`
                  : or(
                        lt(agentActivityTable.runOrder, beforeRunOrder),
                        and(
                            eq(agentActivityTable.runOrder, beforeRunOrder),
                            lt(agentActivityTable.position, input.before.position)
                        )
                    )!
        );
    }
    const rows = await db
        .select()
        .from(agentActivityTable)
        .where(and(...predicates))
        .orderBy(desc(agentActivityTable.runOrder), desc(agentActivityTable.position))
        .limit(input.limit + 1);
    const pageRows = rows.slice(0, input.limit);
    const last = pageRows.at(-1);
    return {
        events: pageRows.map(toAgentActivityEvent),
        nextBefore:
            rows.length > input.limit && last
                ? { position: last.position, runId: last.runId }
                : null,
    };
}

export async function readHostedActiveAgentActivity(
    db: GrottoDatabase,
    serverId: string
): Promise<HostedAgentActiveActivitySnapshot> {
    const rows = await db
        .select({ activity: agentActivityTable })
        .from(agentActivityTable)
        .innerJoin(
            agentDeliveryTable,
            and(
                eq(agentDeliveryTable.serverId, agentActivityTable.serverId),
                eq(agentDeliveryTable.agentId, agentActivityTable.agentId),
                eq(agentDeliveryTable.activeRunId, agentActivityTable.runId)
            )
        )
        .where(eq(agentActivityTable.serverId, serverId))
        .orderBy(desc(agentActivityTable.position));
    const seen = new Set<string>();
    const activities = rows
        .map(({ activity }) => activity)
        .filter((activity) => {
            const key = `${activity.agentId}:${activity.runId}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        })
        .map(toAgentActivityEvent);
    return { activities };
}

export function toAgentActivityEvent(
    row: typeof agentActivityTable.$inferSelect
): HostedAgentActivityEvent {
    return {
        agentId: row.agentId,
        category: row.category,
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        phase: row.phase,
        position: row.position,
        producer: row.producer,
        producerId: row.producerId,
        producerSequence: row.producerSequence,
        runId: row.runId,
        serverId: row.serverId,
        ...(row.toolRef ? { toolRef: row.toolRef } : {}),
    };
}
