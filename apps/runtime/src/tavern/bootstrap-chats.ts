import type { Database } from '../db/sqlite';
import { createAgentParticipantId, createChat, getChat, localHumanParticipantId } from './chat-api';

export { localHumanParticipantId } from './chat-api';

export function seedWorkspaceChats(input: {
    agents: Array<{ id: string; name: string }>;
    db: Database;
}) {
    let seeded = 0;

    for (const agent of input.agents) {
        seeded += ensureAgentDmChat({
            agentId: agent.id,
            agentName: agent.name,
            db: input.db,
        }).seeded;
    }

    return { seeded };
}

export function ensureAgentDmChat(input: { agentId: string; agentName: string; db: Database }) {
    const chatId = agentDmChatId(input.agentId);
    const seeded = getChat(chatId, input.db) ? 0 : 1;

    createChat(
        {
            id: chatId,
            kind: 'dm',
            metadata: runtimeTavernChatMetadata({
                agentIds: [input.agentId],
                displayName: input.agentName,
                kind: 'dm',
            }),
            participants: [
                {
                    id: localHumanParticipantId,
                    kind: 'user',
                    label: 'You',
                    metadata: { source: 'tavern' },
                },
                {
                    id: createAgentParticipantId(input.agentId),
                    kind: 'agent',
                    label: input.agentName,
                    metadata: { agentId: input.agentId, source: 'tavern' },
                },
            ],
            title: input.agentName,
        },
        input.db
    );

    return { chatId, seeded };
}

export function archiveAgentDmChat(input: { agentId: string; db: Database }) {
    const chatId = agentDmChatId(input.agentId);
    const chat = getChat(chatId, input.db);

    if (!chat) {
        return { archived: false, chatId };
    }

    createChat(
        {
            id: chatId,
            kind: 'dm',
            metadata: {
                ...chat.metadata,
                tavern: {
                    ...readRecord(chat.metadata.tavern),
                    archived: true,
                },
            },
        },
        input.db
    );

    return { archived: true, chatId };
}

export function agentDmChatId(agentId: string) {
    return `cht_${agentId.replace(/[^A-Za-z0-9_-]/g, '_')}_dm`;
}

function readRecord(input: unknown) {
    return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

function runtimeTavernChatMetadata(input: { agentIds: string[]; displayName: string; kind: 'dm' }) {
    return {
        runtime: { source: 'tavern' },
        tavern: {
            agentIds: input.agentIds,
            archived: false,
            displayName: input.displayName,
            displayNameSource: 'explicit',
            kind: input.kind,
            tabAppearance: { color: null },
        },
    };
}
