import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { agentCreateActionInputSchema } from '@grotto/api';
import { SQL } from 'bun';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { startPostgresCluster } from './postgres-cluster.ts';

test('migrates historical proposal notes into messages without overwriting authored content', async () => {
    const cluster = await startPostgresCluster();
    const client = new SQL(cluster.databaseUrl);
    try {
        await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
        await client`INSERT INTO servers (id, slug, display_name)
            VALUES ('srv_notes', 'proposal-notes', 'Proposal notes')`;
        await client`INSERT INTO agents (id, server_id, handle, display_name, home_timezone, role)
            VALUES ('agt_notes', 'srv_notes', 'builder', 'Builder', 'UTC', 'member')`;
        await client`INSERT INTO chats (id, server_id, kind, name)
            VALUES ('cht_notes', 'srv_notes', 'channel', 'product')`;

        const cases = [
            {
                content: '',
                hint: 'You are Marlow. Own the shop.',
                expected: 'You are Marlow. Own the shop.',
            },
            { content: 'Original message.', hint: 'Another note.', expected: 'Original message.' },
            { content: '', hint: null, expected: '' },
            { content: '', hint: '', expected: '' },
            { content: ' \n\t ', hint: 'Review this proposal.', expected: 'Review this proposal.' },
        ];
        for (const [index, entry] of cases.entries()) {
            const messageId = `msg_note_${index}`;
            const actionId = `act_${String(index).padStart(16, '0')}`;
            await client`INSERT INTO chat_messages
                (id, server_id, chat_id, author_agent_id, content, nonce, sequence)
                VALUES (${messageId}, 'srv_notes', 'cht_notes', 'agt_notes',
                    ${entry.content}, ${`note-${index}`}, ${index + 1})`;
            await client`INSERT INTO prepared_actions
                (id, server_id, chat_id, message_id, proposer_agent_id, kind, proposal, nonce)
                VALUES (${actionId}, 'srv_notes', 'cht_notes', ${messageId}, 'agt_notes',
                    'agent:create', jsonb_build_object('kind', 'agent:create', 'name', 'Marlow',
                        'draftHint', ${entry.hint}::text), ${`note-${index}`})`;
        }

        const migration = await readFile(
            new URL('../drizzle/postgres/0034_proposal_notes_are_messages.sql', import.meta.url),
            'utf8'
        );
        for (let pass = 0; pass < 2; pass++) {
            for (const statement of migration.split('--> statement-breakpoint')) {
                await client.unsafe(statement);
            }
            const messages = await client`SELECT content FROM chat_messages ORDER BY sequence`;
            expect(messages.map((message) => message.content)).toEqual(
                cases.map((entry) => entry.expected)
            );
            const actions = await client`SELECT proposal FROM prepared_actions ORDER BY id`;
            for (const action of actions) {
                expect(action.proposal).not.toHaveProperty('draftHint');
                expect(agentCreateActionInputSchema.parse(action.proposal).name).toBe('Marlow');
            }
        }
    } finally {
        await client.close();
        await cluster.stop();
    }
}, 30_000);
