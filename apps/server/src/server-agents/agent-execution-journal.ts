import type { AgentExecutionJournalInput, AgentExecutionJournalResult } from '@haus/api';
import { and, eq } from 'drizzle-orm';
import type { ComputerConnections } from '../computers/connections.ts';
import type { HausDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { HausUser } from '../users/haus-user.ts';

export async function requestAgentExecutionJournal(
    db: HausDatabase,
    connections: ComputerConnections,
    member: HausUser | null,
    input: AgentExecutionJournalInput
): Promise<AgentExecutionJournalResult> {
    const server = await requireServerMembership(db, member, input.serverId);
    if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
        throw new AgentExecutionJournalAccessError(
            'Only a Server Owner or Admin can inspect Agent execution details.'
        );
    }
    const [agent] = await db
        .select({ computerId: agentsTable.computerId })
        .from(agentsTable)
        .where(and(eq(agentsTable.id, input.agentId), eq(agentsTable.serverId, input.serverId)))
        .limit(1);
    if (!agent?.computerId) {
        throw new AgentExecutionJournalAccessError('No Agent exists with that id.');
    }
    return await connections.requestExecutionJournal(agent.computerId, {
        agentId: input.agentId,
        runId: input.runId,
        serverId: input.serverId,
    });
}

export class AgentExecutionJournalAccessError extends Error {}
