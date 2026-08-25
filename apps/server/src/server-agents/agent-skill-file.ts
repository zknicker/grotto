import type { AgentSkillFile, AgentSkillFileRequest } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import type { ComputerConnections } from '../computers/connections.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export async function readAgentSkillFile(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: { agentId: string; name: string; serverId: string }
): Promise<AgentSkillFile> {
    const result = await requestAgentSkillFile(db, connections, member, input, {
        kind: 'read',
        name: input.name,
    });
    if (result.kind !== 'read') {
        throw new Error('The Computer returned the wrong Agent skill response.');
    }
    return result.value;
}

export async function updateAgentSkillFile(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: {
        agentId: string;
        content: string;
        expectedHash: string;
        name: string;
        serverId: string;
    }
): Promise<AgentSkillFile> {
    const result = await requestAgentSkillFile(db, connections, member, input, {
        content: input.content,
        expectedHash: input.expectedHash,
        kind: 'update',
        name: input.name,
    });
    if (result.kind !== 'updated') {
        throw new Error('The Computer returned the wrong Agent skill response.');
    }
    return result.value;
}

export async function deleteAgentSkillFile(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: {
        agentId: string;
        expectedHash: string;
        name: string;
        serverId: string;
    }
): Promise<{ deleted: true }> {
    const result = await requestAgentSkillFile(db, connections, member, input, {
        expectedHash: input.expectedHash,
        kind: 'delete',
        name: input.name,
    });
    if (result.kind !== 'deleted') {
        throw new Error('The Computer returned the wrong Agent skill response.');
    }
    return { deleted: true };
}

async function requestAgentSkillFile(
    db: GrottoDatabase,
    connections: ComputerConnections,
    member: GrottoUser | null,
    input: { agentId: string; serverId: string },
    operation: AgentSkillFileRequest['operation']
) {
    const server = await requireServerMembership(db, member, input.serverId);
    if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
        throw new AgentSkillFileAccessError(
            'Only a Server Owner or Admin can manage an Agent skill.'
        );
    }
    const [agent] = await db
        .select({ computerId: agentsTable.computerId })
        .from(agentsTable)
        .where(and(eq(agentsTable.id, input.agentId), eq(agentsTable.serverId, input.serverId)))
        .limit(1);
    if (!agent?.computerId) {
        throw new AgentSkillFileAccessError('No Agent exists with that id.');
    }
    return connections.requestSkillFile(agent.computerId, {
        agentId: input.agentId,
        operation,
    });
}

export class AgentSkillFileAccessError extends Error {}
