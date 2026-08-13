import type { ServerUsageOverview, UsageOverview } from '@tavern/api';
import { and, desc, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computersTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export async function recordComputerUsage(
    db: GrottoDatabase,
    input: {
        computerId: string;
        serverId: string;
        usage: UsageOverview;
    }
) {
    await db
        .update(computersTable)
        .set({
            usageReportedAt: new Date(),
            usageSnapshot: input.usage,
        })
        .where(
            and(
                eq(computersTable.id, input.computerId),
                eq(computersTable.serverId, input.serverId)
            )
        );
}

export async function readServerUsage(
    db: GrottoDatabase,
    member: GrottoUser | null,
    serverId: string
): Promise<ServerUsageOverview> {
    await requireServerMembership(db, member, serverId);
    const computers = await db
        .select({
            architecture: computersTable.architecture,
            computerId: computersTable.id,
            health: computersTable.health,
            operatingSystem: computersTable.operatingSystem,
            productVersion: computersTable.productVersion,
            reportedAt: computersTable.usageReportedAt,
            usage: computersTable.usageSnapshot,
        })
        .from(computersTable)
        .where(eq(computersTable.serverId, serverId))
        .orderBy(desc(computersTable.createdAt));

    return {
        computers: computers.map((computer) => ({
            ...computer,
            reportedAt: computer.reportedAt?.toISOString() ?? null,
            usage: computer.usage ?? null,
        })),
    };
}
