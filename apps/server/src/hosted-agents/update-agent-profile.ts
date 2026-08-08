import type { HostedAgent, HostedUpdateAgentProfileInput } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { AgentConfigDeniedError } from './agent-config-errors.ts';
import { listHostedAgents } from './list-agents.ts';

export async function updateHostedAgentProfile(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedUpdateAgentProfileInput
): Promise<HostedAgent> {
    const server = await requireServerMembership(db, member, input.serverId);
    if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
        throw new AgentConfigDeniedError('Only a Server Owner or Admin can edit an Agent.');
    }

    const [identity] = await db
        .select({ factoryKind: agentsTable.factoryKind })
        .from(agentsTable)
        .where(and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, input.agentId)))
        .limit(1);
    if (identity?.factoryKind === 'cove') {
        throw new AgentConfigDeniedError("Cove's product-owned identity cannot be changed.");
    }

    const [updated] = await db
        .update(agentsTable)
        .set({
            description: input.description,
            displayName: input.displayName,
        })
        .where(and(eq(agentsTable.serverId, input.serverId), eq(agentsTable.id, input.agentId)))
        .returning({ id: agentsTable.id });
    if (!updated) {
        throw new AgentConfigDeniedError('No configured Agent exists with that id.');
    }

    const agent = (await listHostedAgents(db, member, input.serverId)).find(
        (candidate) => candidate.id === input.agentId
    );
    if (!agent) {
        throw new AgentConfigDeniedError('No configured Agent exists with that id.');
    }
    return agent;
}
