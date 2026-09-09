import type { GrottoAgentMessage } from '@grotto/api';
import { readChatMessageReactions } from '../chats/message-reactions.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';

type AgentMessageReaction = NonNullable<GrottoAgentMessage['reactions']>[number];

/** Projects the shared Chat reaction relation into the Agent API's stable shape. */
export async function readMessageReactions(
    db: GrottoDatabase,
    serverId: string,
    messageIds: string[]
): Promise<Map<string, AgentMessageReaction[]>> {
    const reactionsByMessage = await readChatMessageReactions(db, serverId, messageIds);
    return new Map(
        [...reactionsByMessage].map(([messageId, reactions]) => [
            messageId,
            reactions.map(({ actors, emoji }) => ({
                actors: actors.map(({ handle, id }) => ({ handle, id })),
                emoji,
            })),
        ])
    );
}
