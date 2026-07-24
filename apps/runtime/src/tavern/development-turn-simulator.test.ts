import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { createChat, createMessage, getChatTimelinePage } from './chat-api';
import { simulateDevelopmentTurn } from './development-turn-simulator';

describe('development turn simulator', () => {
    beforeEach(() => {
        process.env.TAVERN_DEV_STACK = '1';
        ensureRuntimeSchema(initTestDb());
        // The simulator drives the chat's first agent seat; there is no
        // fallback agent id anymore (ADR 0018).
        createChat({
            id: 'cht_devsim',
            participants: [
                { id: 'agt_devsim', kind: 'agent', label: 'Devsim', metadata: {} },
                { id: 'usr_1', kind: 'user', label: 'You', metadata: {} },
            ],
            title: 'devsim',
        });
        createMessage('cht_devsim', {
            author_id: 'usr_1',
            content: 'run something',
            id: 'msg_req_1',
            role: 'user',
        });
    });

    afterEach(() => {
        process.env.TAVERN_DEV_STACK = undefined;
        closeDb();
    });

    it('writes a complete streamed turn: tools, narration, and a final reply', async () => {
        const simulation = simulateDevelopmentTurn({ chatId: 'cht_devsim', paceMs: 0 });
        await simulation.run;

        const page = getChatTimelinePage('cht_devsim', { limit: 20 });
        const response = page.responses.find(
            (entry) => entry.id === simulation.receipt.response_id
        );

        expect(response?.status).toBe('completed');
        expect(response?.response_message_id).toBe(`msg_${simulation.receipt.run_id}_assistant`);

        const kinds = page.activity
            .filter((activity) => activity.response_id === simulation.receipt.response_id)
            .map((activity) => activity.kind)
            .sort();
        expect(kinds).toEqual(['message', 'tool_call', 'tool_call', 'tool_call']);

        const reply = page.messages.find(
            (message) => message.id === `msg_${simulation.receipt.run_id}_assistant`
        );
        expect(reply?.role).toBe('assistant');
        expect(reply?.content.length).toBeGreaterThan(0);
        // The delivery settles the post even when the last streamed edit
        // already matched the final text: a lingering streaming flag would
        // keep the thinking indicator alive forever.
        const runtime = reply?.metadata.runtime as Record<string, unknown> | undefined;
        expect(runtime?.streaming).toBeUndefined();
    });

    it('writes the long narration turn: preamble, reasoning, intra-turn updates, reply', async () => {
        const simulation = simulateDevelopmentTurn({
            chatId: 'cht_devsim',
            paceMs: 0,
            scenario: 'narration',
        });
        await simulation.run;

        const page = getChatTimelinePage('cht_devsim', { limit: 30 });
        const response = page.responses.find(
            (entry) => entry.id === simulation.receipt.response_id
        );
        expect(response?.status).toBe('completed');

        const activity = page.activity.filter(
            (entry) => entry.response_id === simulation.receipt.response_id
        );
        const kinds = activity.map((entry) => entry.kind).sort();
        expect(kinds).toEqual([
            'message',
            'message',
            'message',
            'reasoning',
            'tool_call',
            'tool_call',
            'tool_call',
        ]);

        const narrationDetails = activity
            .filter((entry) => entry.kind === 'message')
            .map((entry) => entry.detail);
        expect(narrationDetails).toHaveLength(3);
        expect(new Set(narrationDetails).size).toBe(3);
    });

    it('writes a failed turn for the failure scenario', async () => {
        const simulation = simulateDevelopmentTurn({
            chatId: 'cht_devsim',
            paceMs: 0,
            scenario: 'failure',
        });
        await simulation.run;

        const page = getChatTimelinePage('cht_devsim', { limit: 20 });
        const response = page.responses.find(
            (entry) => entry.id === simulation.receipt.response_id
        );

        expect(response?.status).toBe('failed');
        expect(response?.response_message_id).toBeNull();
        expect(response?.metadata.error).toContain('Simulated failure');
    });

    it('runs two agent seats concurrently for the multi-agent scenario', async () => {
        for (const agentId of ['agt_alpha', 'agt_beta']) {
            createMessage('cht_devsim', {
                author_id: agentId,
                content: `seed ${agentId}`,
                id: `msg_seed_${agentId}`,
                role: 'assistant',
            });
        }

        const simulation = simulateDevelopmentTurn({
            chatId: 'cht_devsim',
            paceMs: 0,
            scenario: 'multi-agent',
        });
        await simulation.run;

        const page = getChatTimelinePage('cht_devsim', { limit: 40 });
        const completed = page.responses.filter((entry) => entry.id.startsWith('rsp_devsim_'));
        expect(completed).toHaveLength(2);
        expect(completed.every((entry) => entry.status === 'completed')).toBe(true);
        expect(new Set(completed.map((entry) => entry.participant_id))).toEqual(
            new Set(['agt_alpha', 'agt_beta'])
        );

        const replies = page.messages.filter((message) =>
            completed.some((entry) => entry.response_message_id === message.id)
        );
        expect(replies).toHaveLength(2);
        expect(new Set(replies.map((message) => message.content)).size).toBe(2);
    });

    it('rejects the multi-agent scenario in a single-agent chat', () => {
        expect(() =>
            simulateDevelopmentTurn({
                chatId: 'cht_devsim',
                paceMs: 0,
                scenario: 'multi-agent',
            })
        ).toThrow(/two agents/);
    });

    it('refuses to run outside the development stack', () => {
        process.env.TAVERN_DEV_STACK = undefined;

        expect(() => simulateDevelopmentTurn({ chatId: 'cht_devsim', paceMs: 0 })).toThrow(
            /development stack/
        );
    });
});
