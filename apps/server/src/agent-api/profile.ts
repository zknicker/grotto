import { and, eq, isNull } from 'drizzle-orm';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable } from '../postgres/schema.ts';
import { AgentTargetError } from './resolve-target.ts';

export async function readAgentProfile(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    target?: string
) {
    const handle = stripAt(target ?? '');
    if (handle === 'operator') {
        return { profile: { description: null, handle, isSelf: false } };
    }
    const [agent] = await db
        .select({
            description: agentsTable.description,
            handle: agentsTable.handle,
            id: agentsTable.id,
        })
        .from(agentsTable)
        .where(
            and(
                eq(agentsTable.serverId, runner.serverId),
                target ? eq(agentsTable.handle, handle) : eq(agentsTable.id, runner.agentId),
                isNull(agentsTable.retiredAt)
            )
        )
        .limit(1);
    if (!agent) {
        throw new AgentTargetError('No visible participant has that handle.');
    }
    return {
        profile: {
            description: agent.description,
            handle: agent.handle,
            isSelf: agent.id === runner.agentId,
        },
    };
}

export async function updateAgentProfile(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    description: string
) {
    const [agent] = await db
        .update(agentsTable)
        .set({ description })
        .where(
            and(
                eq(agentsTable.serverId, runner.serverId),
                eq(agentsTable.id, runner.agentId),
                isNull(agentsTable.retiredAt)
            )
        )
        .returning({ description: agentsTable.description, handle: agentsTable.handle });
    if (!agent) {
        throw new AgentTargetError('This Agent is not active.');
    }
    return { profile: { ...agent, isSelf: true } };
}

function stripAt(value: string) {
    return value.startsWith('@') ? value.slice(1) : value;
}
