import type { HostedAgent, HostedAgentAvailability, HostedAgentStatus } from '@tavern/api';
import { avatarUrlFor } from '../avatars/avatar-url.ts';

export interface ConfiguredAgentRow {
    activeRunId: string | null;
    avatarId: string | null;
    computerHealth: 'degraded' | 'healthy' | 'offline' | 'update-required';
    computerId: string | null;
    consecutiveFailures: number;
    createdAt: Date;
    createdByUserId: string | null;
    description: string | null;
    desiredModelId: string | null;
    desiredRuntimeId: string | null;
    displayName: string;
    dmChatId: string | null;
    effectiveMissing: string[] | null;
    effectiveModelId: string | null;
    effectiveReportedAt: Date | null;
    effectiveRuntimeId: string | null;
    factoryKind: 'cove' | 'ordinary';
    handle: string;
    id: string;
    role: 'admin' | 'member';
    serverId: string;
    stopped: boolean;
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

export function deriveAgentAvailability(row: ConfiguredAgentRow): HostedAgentAvailability {
    if (row.computerHealth !== 'healthy') {
        return 'offline';
    }
    if (row.stopped) {
        return 'stopped';
    }
    if (row.activeRunId) {
        return 'working';
    }
    if (row.consecutiveFailures > 0) {
        return 'error';
    }
    return 'idle';
}

/** Projects a configured Agent row into its public contract for one viewer. */
export function toHostedAgent(row: ConfiguredAgentRow): HostedAgent {
    if (!(row.computerId && row.desiredRuntimeId && row.desiredModelId)) {
        throw new Error('Only a fully configured Agent can be projected to the contract.');
    }

    return {
        availability: deriveAgentAvailability(row),
        avatarUrl: avatarUrlFor(row.avatarId),
        computerId: row.computerId,
        createdAt: row.createdAt.toISOString(),
        createdByUserId: row.createdByUserId ?? null,
        description: row.description,
        desiredModelId: row.desiredModelId,
        desiredRuntimeId: row.desiredRuntimeId,
        displayName: row.displayName,
        dmChatId: row.dmChatId,
        effectiveModelId: row.effectiveModelId,
        effectiveReportedAt: row.effectiveReportedAt?.toISOString() ?? null,
        effectiveRuntimeId: row.effectiveRuntimeId,
        factoryKind: row.factoryKind,
        handle: row.handle,
        id: row.id,
        missingResources: row.effectiveMissing ?? [],
        role: row.role,
        serverId: row.serverId,
        status: deriveAgentStatus(row),
    };
}
