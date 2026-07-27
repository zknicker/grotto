import type { HostedAgent, HostedAgentStatus } from '@tavern/api';

export interface ConfiguredAgentRow {
    computerId: string | null;
    createdAt: Date;
    desiredModelId: string | null;
    desiredRuntimeId: string | null;
    displayName: string;
    dmChatId: string | null;
    effectiveMissing: string[] | null;
    effectiveModelId: string | null;
    effectiveReportedAt: Date | null;
    effectiveRuntimeId: string | null;
    handle: string;
    id: string;
    role: 'admin' | 'member';
    serverId: string;
}

/**
 * Desired state is pending until the Computer reports a matching effective
 * snapshot. A reported snapshot with missing local resources is degraded, and
 * Grotto never substitutes a different runtime or model to hide the gap.
 */
export function deriveAgentStatus(row: ConfiguredAgentRow): HostedAgentStatus {
    if (!row.effectiveReportedAt) {
        return 'pending';
    }

    if ((row.effectiveMissing ?? []).length > 0) {
        return 'degraded';
    }

    const matches =
        row.effectiveRuntimeId === row.desiredRuntimeId &&
        row.effectiveModelId === row.desiredModelId;

    return matches ? 'applied' : 'pending';
}

/** Projects a configured Agent row into its public contract for one viewer. */
export function toHostedAgent(row: ConfiguredAgentRow): HostedAgent {
    if (!(row.computerId && row.desiredRuntimeId && row.desiredModelId)) {
        throw new Error('Only a fully configured Agent can be projected to the contract.');
    }

    return {
        computerId: row.computerId,
        createdAt: row.createdAt.toISOString(),
        desiredModelId: row.desiredModelId,
        desiredRuntimeId: row.desiredRuntimeId,
        displayName: row.displayName,
        dmChatId: row.dmChatId,
        effectiveModelId: row.effectiveModelId,
        effectiveReportedAt: row.effectiveReportedAt?.toISOString() ?? null,
        effectiveRuntimeId: row.effectiveRuntimeId,
        handle: row.handle,
        id: row.id,
        missingResources: row.effectiveMissing ?? [],
        role: row.role,
        serverId: row.serverId,
        status: deriveAgentStatus(row),
    };
}
