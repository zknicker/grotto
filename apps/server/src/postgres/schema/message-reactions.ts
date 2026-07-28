import { foreignKey, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { agentsTable } from './agents.ts';
import { chatMessagesTable } from './chat-messages.ts';

export const messageReactionsTable = pgTable(
    'message_reactions',
    {
        actorAgentId: text('actor_agent_id').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        emoji: text('emoji').notNull(),
        messageId: text('message_id').notNull(),
        serverId: text('server_id').notNull(),
    },
    (table) => [
        uniqueIndex('message_reactions_actor_key').on(
            table.serverId,
            table.messageId,
            table.actorAgentId,
            table.emoji
        ),
        foreignKey({
            columns: [table.serverId, table.messageId],
            foreignColumns: [chatMessagesTable.serverId, chatMessagesTable.id],
            name: 'message_reactions_message_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.serverId, table.actorAgentId],
            foreignColumns: [agentsTable.serverId, agentsTable.id],
            name: 'message_reactions_actor_agent_fk',
        }).onDelete('cascade'),
    ]
);
