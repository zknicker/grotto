import type { AgentCommand, AgentReasoningEffort } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';

/**
 * What the Server tells a Computer to run an Agent as: identity, desired
 * runtime and model, factory state, and the standing brief the Computer seeds
 * into a fresh workspace. Read on every dispatch and every reconnect, so it
 * lives apart from the delivery queue's own row bookkeeping.
 */

export interface AgentDispatchConfig {
    agentDescription: string | null;
    agentDisplayName: string;
    agentName: string;
    brief: string | null;
    briefAuthorHandle: string | null;
    computerId: string | null;
    desiredModelId: string | null;
    desiredReasoningEffort: AgentReasoningEffort;
    desiredRuntimeId: string | null;
    factoryAppliedAt: Date | null;
    factoryKind: 'cove' | 'ordinary';
    homeTimezone: string;
    retiredAt: Date | null;
    sessionGeneration: number;
    sessionResetKind: 'full' | 'session';
}

/** The Agent's assigned Computer and desired runtime/model, or nulls when unconfigured. */
export async function readAgentDispatchConfig(
    db: GrottoDatabase,
    agentId: string
): Promise<AgentDispatchConfig | null> {
    const creator = alias(agentsTable, 'creator_agent');
    const [row] = await db
        .select({
            agentDescription: agentsTable.description,
            agentDisplayName: agentsTable.displayName,
            agentName: agentsTable.handle,
            brief: agentsTable.brief,
            briefAuthorHandle: creator.handle,
            computerId: agentsTable.computerId,
            desiredModelId: agentsTable.desiredModelId,
            desiredReasoningEffort: agentsTable.desiredReasoningEffort,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
            factoryAppliedAt: agentsTable.factoryAppliedAt,
            factoryKind: agentsTable.factoryKind,
            homeTimezone: agentsTable.homeTimezone,
            retiredAt: agentsTable.retiredAt,
            sessionGeneration: agentsTable.sessionGeneration,
            sessionResetKind: agentsTable.sessionResetKind,
        })
        .from(agentsTable)
        .leftJoin(
            creator,
            and(
                eq(creator.serverId, agentsTable.serverId),
                eq(creator.id, agentsTable.createdByAgentId)
            )
        )
        .where(eq(agentsTable.id, agentId))
        .limit(1);
    return row ?? null;
}

/** Agents assigned to one Computer, for reconnect reconciliation. */
export interface ComputerAgentRow {
    agentDescription: string | null;
    agentId: string;
    agentName: string;
    brief: string | null;
    briefAuthorHandle: string | null;
    desiredModelId: string | null;
    desiredReasoningEffort: AgentReasoningEffort;
    desiredRuntimeId: string | null;
    factoryAppliedAt: Date | null;
    factoryKind: 'cove' | 'ordinary';
    retiredAt: Date | null;
    serverId: string;
    sessionGeneration: number;
    sessionResetKind: 'full' | 'session';
}

export async function listComputerAgents(
    db: GrottoDatabase,
    computerId: string
): Promise<ComputerAgentRow[]> {
    const creator = alias(agentsTable, 'creator_agent');
    const rows = await db
        .select({
            agentDescription: agentsTable.description,
            agentId: agentsTable.id,
            agentName: agentsTable.displayName,
            brief: agentsTable.brief,
            briefAuthorHandle: creator.handle,
            desiredModelId: agentsTable.desiredModelId,
            desiredReasoningEffort: agentsTable.desiredReasoningEffort,
            desiredRuntimeId: agentsTable.desiredRuntimeId,
            factoryAppliedAt: agentsTable.factoryAppliedAt,
            factoryKind: agentsTable.factoryKind,
            retiredAt: agentsTable.retiredAt,
            sessionGeneration: agentsTable.sessionGeneration,
            sessionResetKind: agentsTable.sessionResetKind,
            serverId: agentsTable.serverId,
        })
        .from(agentsTable)
        .leftJoin(
            creator,
            and(
                eq(creator.serverId, agentsTable.serverId),
                eq(creator.id, agentsTable.createdByAgentId)
            )
        )
        .where(eq(agentsTable.computerId, computerId));
    return rows;
}

/** One reconnect row as the `agent-configure` frame its Computer expects. */
export function reconcileConfigureFrame(
    agent: ComputerAgentRow & { desiredModelId: string; desiredRuntimeId: string }
): AgentCommand {
    return {
        agentDescription: agent.agentDescription,
        agentId: agent.agentId,
        agentName: agent.agentName,
        brief: agent.brief,
        briefAuthorHandle: agent.briefAuthorHandle,
        factoryKind: agent.factoryKind,
        modelId: agent.desiredModelId,
        reasoningEffort: agent.desiredReasoningEffort,
        runtimeId: agent.desiredRuntimeId,
        sessionGeneration: agent.sessionGeneration,
        sessionResetKind: agent.sessionResetKind,
        type: 'agent-configure',
    };
}

/** What a caller must name to push one Agent's configuration to its Computer. */
export interface AgentConfigureRequest {
    agentDescription: string | null;
    agentId: string;
    agentName: string;
    computerId: string;
    modelId: string;
    reasoningEffort: AgentReasoningEffort;
    runtimeId: string;
}
