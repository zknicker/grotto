import type { MessageBody } from '@grotto/api';
import { readAsksForMessages } from '../asks/ask-shape.ts';
import { readCloudAgentWorkForMessages } from '../cloud-agents/cloud-agent-shape.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { readCreatedAgentsForMessages } from '../server-agents/agent-created-shape.ts';

/**
 * Projects every typed Message body for one page of Messages. This is the one
 * place a Server record becomes a `Message.body`, so Chat history, Threads,
 * search, and Task rows all read the same projection.
 */
export async function readMessageBodies(
    db: Pick<GrottoDatabase, 'select'>,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, MessageBody>> {
    const [asks, cloudAgentWork, createdAgents] = await Promise.all([
        readAsksForMessages(db, serverId, messageIds),
        readCloudAgentWorkForMessages(db, serverId, messageIds),
        readCreatedAgentsForMessages(db, serverId, messageIds),
    ]);
    return new Map<string, MessageBody>([
        ...[...asks].map(
            ([messageId, ask]) => [messageId, { ask, kind: 'ask' }] as [string, MessageBody]
        ),
        ...[...cloudAgentWork].map(
            ([messageId, work]) =>
                [messageId, { kind: 'cloud-agent-work', work }] as [string, MessageBody]
        ),
        ...[...createdAgents].map(
            ([messageId, agent]) =>
                [messageId, { agent, kind: 'agent-created' }] as [string, MessageBody]
        ),
    ]);
}
