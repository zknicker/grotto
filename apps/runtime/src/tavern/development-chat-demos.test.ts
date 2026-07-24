import {
    developmentChatDemoId,
    developmentChatTeamDemoId,
    developmentChatVisualsDemoId,
} from '@tavern/api/development-chat-demos';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { namedParams } from '../db/sqlite';
import { toAgentMessage } from './agent-messages';
import { getStoredAgent, listStoredAgents } from './agents-store';
import { getChat, getMessage } from './chat-api';
import { developmentChatDemos } from './development-chat-demo-definitions';
import { demoUserHandle } from './development-chat-demo-types';
import { seedDevelopmentChatDemos } from './development-chat-demos';
import { assertValidHandle } from './handles';

describe('development chat demo sessions', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('seeds the team demo with two named agent seats and per-seat messages', async () => {
        const { agentIds } = await seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        // Both seats are real stored agents created through the normal
        // create path: generated prod-shape ids, never hardcoded seeds.
        expect(agentIds).not.toBeNull();
        if (!agentIds) {
            return;
        }
        expect(agentIds.otto).toMatch(/^agt_otto_[0-9a-f]{8}$/u);
        expect(agentIds.wren).toMatch(/^agt_wren_[0-9a-f]{8}$/u);
        expect(getStoredAgent(agentIds.otto)?.name).toBe('Otto');
        expect(getStoredAgent(agentIds.wren)?.name).toBe('Wren');

        // Reseeding resolves the same agents by name instead of minting more.
        const again = await seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        expect(again.agentIds).toEqual(agentIds);
        expect(listStoredAgents(getDb()).agents).toHaveLength(2);

        const chat = getChat(developmentChatTeamDemoId);
        const agentSeats = chat?.participants.filter((participant) => participant.kind === 'agent');
        expect(new Set(agentSeats?.map((participant) => participant.id))).toEqual(
            new Set([agentIds.otto, agentIds.wren])
        );

        // One assistant message per seat.
        const messages = getDb()
            .prepare('SELECT author_id FROM chat_messages WHERE chat_id = $chatId AND role = $role')
            .all(namedParams({ chatId: developmentChatTeamDemoId, role: 'assistant' })) as {
            author_id: string;
        }[];
        expect(new Set(messages.map((row) => row.author_id))).toEqual(
            new Set([agentIds.otto, agentIds.wren])
        );
    });

    // Seed lint: seeds bypass write-time handle validation (direct inserts),
    // so drift in the definitions must fail here instead of surfacing as
    // '@unknown' envelopes or an unresolvable target in grotto CLI smokes.
    it('seeds only handle-valid chat titles, agent names, and sender handles', async () => {
        const { agentIds } = await seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        if (!agentIds) {
            throw new Error('expected demo agents');
        }

        for (const demo of developmentChatDemos(agentIds)) {
            // Channel titles ARE channel handles (D2).
            assertValidHandle(demo.title, `Chat title for ${demo.chatId}`);
            for (const agentId of demo.agentIds) {
                const name = getStoredAgent(agentId)?.name;
                expect(name, `stored agent ${agentId}`).toBeTruthy();
                assertValidHandle(name ?? '', `Agent name for ${agentId}`);
            }
            for (const seeded of demo.messages) {
                const message = getMessage(seeded.id);
                expect(message, `seeded message ${seeded.id}`).toBeTruthy();
                if (!message) {
                    continue;
                }
                const { sender } = toAgentMessage(message);
                expect(sender.handle, `sender handle for ${seeded.id}`).toBeTruthy();
                assertValidHandle(sender.handle ?? '', `Sender handle for ${seeded.id}`);
            }
        }
    });

    it('stamps the demo user handle without clobbering observed labels', async () => {
        await seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        const labelFor = (chatId: string, id: string) =>
            (
                getDb()
                    .prepare(
                        'SELECT label FROM chat_participants WHERE chat_id = $chatId AND id = $id'
                    )
                    .get(namedParams({ chatId, id })) as { label: string | null } | null
            )?.label;
        expect(labelFor(developmentChatDemoId, 'usr_demo')).toBe(demoUserHandle);
        expect(labelFor(developmentChatDemoId, 'usr_tavern')).toBe('You');

        // Existing dev DBs are never relabeled: an observed label wins over
        // the seed stamp on re-runs.
        getDb()
            .prepare(
                `UPDATE chat_participants SET label = 'Observed'
                 WHERE chat_id = $chatId AND id = 'usr_demo'`
            )
            .run(namedParams({ chatId: developmentChatDemoId }));
        await seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        expect(labelFor(developmentChatDemoId, 'usr_demo')).toBe('Observed');
    });

    it('seeds the visuals gallery channel with assistant messages carrying visual fences', async () => {
        await seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        // Idempotent across restarts: reseeding leaves the same stable rows.
        await seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        expect(getChat(developmentChatVisualsDemoId)?.title).toBe('visuals');

        const messages = getDb()
            .prepare(
                `SELECT content FROM chat_messages
                 WHERE chat_id = $chatId AND role = 'assistant'
                 ORDER BY id ASC`
            )
            .all(namedParams({ chatId: developmentChatVisualsDemoId })) as { content: string }[];

        expect(messages.length).toBeGreaterThan(0);
        for (const message of messages) {
            expect(message.content).toContain('```visual');
        }
    });
});
