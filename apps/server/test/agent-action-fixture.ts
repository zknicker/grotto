import { randomBytes } from 'node:crypto';
import type { AgentCreateActionResult } from '@grotto/api';
import type { GrottoDatabase } from '../src/postgres/connection.ts';
import { createOpaqueId } from '../src/postgres/opaque-id.ts';
import {
    agentActionAttentionsTable,
    agentsTable,
    chatMessagesTable,
    preparedActionsTable,
} from '../src/postgres/schema.ts';

export async function seedCommittedAgentAction(
    db: GrottoDatabase,
    seed: {
        agentId: string;
        chatId: string;
        computerId: string;
        serverId: string;
        userId: string;
    },
    suffix: string
) {
    const actionId = createOpaqueId('act');
    const createdAgentId = createOpaqueId('agt');
    const messageId = createOpaqueId('msg');
    await db.insert(chatMessagesTable).values({
        authorUserId: seed.userId,
        chatId: seed.chatId,
        content: `Prepare ${suffix}.`,
        id: messageId,
        nonce: createOpaqueId('nonce'),
        sequence: 1,
        serverId: seed.serverId,
    });
    const result: AgentCreateActionResult = {
        agentId: createdAgentId,
        avatarUrl: null,
        computerId: seed.computerId,
        description: `Created for ${suffix}.`,
        displayName: `Created ${suffix}`,
        handle: `created-${randomBytes(4).toString('hex')}`,
        modelId: 'fake-model',
        reasoningEffort: 'medium',
        role: 'member',
        runtimeId: 'fake',
    };
    await db.insert(agentsTable).values({
        computerId: seed.computerId,
        description: result.description,
        desiredModelId: result.modelId,
        desiredReasoningEffort: result.reasoningEffort,
        desiredRuntimeId: result.runtimeId,
        displayName: result.displayName,
        handle: result.handle,
        homeTimezone: 'UTC',
        id: createdAgentId,
        role: result.role,
        serverId: seed.serverId,
    });
    await db.insert(preparedActionsTable).values({
        chatId: seed.chatId,
        executedAt: new Date(),
        executedByUserId: seed.userId,
        executedResult: result,
        id: actionId,
        kind: 'agent:create',
        messageId,
        nonce: `action-${suffix}-${randomBytes(4).toString('hex')}`,
        proposal: { kind: 'agent:create', name: result.displayName },
        proposerAgentId: seed.agentId,
        serverId: seed.serverId,
        status: 'executed',
    });
    await db.insert(agentActionAttentionsTable).values({
        actionId,
        agentId: seed.agentId,
        chatId: seed.chatId,
        createdAgentId,
        dedupeKey: actionId,
        executedResult: result,
        id: createOpaqueId('aat'),
        serverId: seed.serverId,
        source: 'action',
    });
    return { actionId, createdAgentId, messageId, result };
}
