import {
    formatAgentReferenceTarget,
    formatSkillReferenceTarget,
    type MentionOption,
} from '@tavern/api';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    chatsTable,
    computersTable,
} from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireChatAccess } from './chat-access.ts';

export async function listMentionOptions(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { agentIds: string[]; chatId: string; serverId: string }
): Promise<{ options: MentionOption[] }> {
    const chat = await requireChatAccess(db, member, input);
    const participantAgentIds = await listParticipantAgentIds(db, {
        chatId: chat.kind === 'thread' ? (chat.parentChatId ?? chat.id) : chat.id,
        serverId: input.serverId,
    });
    const participantSet = new Set(participantAgentIds);
    const skillAgentIds =
        input.agentIds.length > 0
            ? input.agentIds.filter((agentId) => participantSet.has(agentId))
            : participantAgentIds;

    if (participantAgentIds.length === 0) {
        return { options: [] };
    }

    const rows = await db
        .select({
            computerInventory: computersTable.reportedInventory,
            displayName: agentsTable.displayName,
            id: agentsTable.id,
        })
        .from(agentsTable)
        .innerJoin(
            computersTable,
            and(
                eq(computersTable.serverId, agentsTable.serverId),
                eq(computersTable.id, agentsTable.computerId)
            )
        )
        .where(
            and(
                eq(agentsTable.serverId, input.serverId),
                inArray(agentsTable.id, participantAgentIds),
                isNull(agentsTable.retiredAt)
            )
        )
        .orderBy(agentsTable.createdAt);

    const agentOptions = rows.map(
        (agent): MentionOption => ({
            description: 'Agent in this chat',
            id: formatAgentReferenceTarget(agent.id),
            insertText: `@${agent.displayName}`,
            kind: 'agent',
            label: agent.displayName,
            projection: 'agent-reference',
            sourceLabel: 'Agents',
        })
    );
    const skillScope = new Set(skillAgentIds);
    const skillOptions = new Map<string, MentionOption>();

    for (const agent of rows) {
        if (!skillScope.has(agent.id)) {
            continue;
        }
        const skills =
            agent.computerInventory?.agentSkills?.find((entry) => entry.agentId === agent.id)
                ?.skills ?? [];
        for (const skill of skills) {
            if (!skillOptions.has(skill.name)) {
                skillOptions.set(skill.name, {
                    description: skill.description || null,
                    id: formatSkillReferenceTarget(skill.name),
                    insertText: skill.name,
                    kind: 'skill',
                    label: skill.name,
                    projection: 'skill-activation',
                    sourceLabel: 'Skills',
                });
            }
        }
    }

    return { options: [...agentOptions, ...skillOptions.values()] };
}

async function listParticipantAgentIds(
    db: GrottoDatabase,
    input: { chatId: string; serverId: string }
): Promise<string[]> {
    const [chat] = await db
        .select({ dmAgentId: chatsTable.dmAgentId, kind: chatsTable.kind })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .limit(1);

    if (!chat) {
        return [];
    }
    if (chat.kind === 'dm') {
        return chat.dmAgentId ? [chat.dmAgentId] : [];
    }

    const participants = await db
        .select({ agentId: channelAgentParticipantsTable.agentId })
        .from(channelAgentParticipantsTable)
        .where(
            and(
                eq(channelAgentParticipantsTable.serverId, input.serverId),
                eq(channelAgentParticipantsTable.chatId, input.chatId)
            )
        )
        .orderBy(channelAgentParticipantsTable.createdAt);

    return participants.map((participant) => participant.agentId);
}
