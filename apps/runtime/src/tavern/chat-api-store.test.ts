import { runtimeRoutes, type TavernChatEvent, type TavernCreateChatRequest } from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { localHumanParticipantId, seedWorkspaceChats } from './bootstrap-chats';
import {
    clearChat,
    createDelivery,
    createMessage,
    createChat as createRuntimeChat,
    deleteResponse,
    getChat,
    getResponse,
    getResponseActivity,
    listChats,
    listEvents,
    listMessages,
    listResponses,
    markRead,
    searchMessages,
    subscribeToTavernApiEvents,
    upsertArtifact,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api';
import { insertEvent } from './chat-api/events';
import { seedDevelopmentChatDemos } from './development-chat-demos';
import { handleTavernRuntimeRequest } from './router';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';

describe('Tavern Runtime Chat API store', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('seeds development chat demos as durable Runtime chats', async () => {
        const first = await seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        const second = await seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        expect(first.seeded).toBe(3);
        expect(second.seeded).toBe(3);
        expect(second.agentIds).toEqual(first.agentIds);
        const agentIds = first.agentIds;
        if (!agentIds) {
            throw new Error('expected demo agents');
        }
        // Seeding ensures both demo agents, which carry their built-in DMs —
        // the same invariant every real boot has.
        expect(
            listChats()
                .chats.map((chat) => chat.id)
                .sort()
        ).toEqual(
            [
                `cht_${agentIds.otto}_dm`,
                `cht_${agentIds.wren}_dm`,
                developmentChatDemoIds.demo,
                developmentChatDemoIds.team,
                developmentChatDemoIds.visuals,
            ].sort()
        );
        expect(getChat(developmentChatDemoIds.demo)).toMatchObject({
            id: developmentChatDemoIds.demo,
            metadata: {
                tavern: {
                    displayName: 'demo',
                    tabAppearance: { color: '#0ea5e9' },
                },
            },
            title: 'demo',
        });

        const demoMessages = listMessages(developmentChatDemoIds.demo).messages;
        expect(demoMessages).toHaveLength(10);
        expect(demoMessages.map((message) => message.role)).toEqual(
            Array.from({ length: 10 }, (_, index) => (index % 2 === 0 ? 'user' : 'assistant'))
        );
        expect(demoMessages.map((message) => message.id).slice(0, 4)).toEqual([
            'msg_demo_artifact_links_request',
            'msg_demo_artifact_links_response',
            'msg_demo_long_content_request',
            'msg_demo_long_content_response',
        ]);
        expect(
            listMessages(developmentChatDemoIds.demo).messages.find(
                (message) => message.id === 'msg_demo_attachment_request'
            )?.attachments
        ).toEqual([expect.objectContaining({ filename: 'weather-request.txt', type: 'file' })]);
    });

    it('removes obsolete per-feature development demo chats', async () => {
        createChat({
            id: 'cht_demo_artifact_links',
            metadata: {
                tavern: {
                    archived: false,
                    displayName: 'Demo: Artifact Links',
                },
            },
            title: 'demo-artifact-links',
        });
        createMessage(
            'cht_demo_artifact_links',
            messageInput('msg_demo_artifact_links_request', 'old-user', 'old')
        );
        createMessage(
            'cht_demo_artifact_links',
            messageInput('msg_demo_artifact_links_response', 'old-agent', 'old response')
        );

        await expect(
            seedDevelopmentChatDemos({ db: getDb(), enabled: true })
        ).resolves.toBeTruthy();

        expect(getChat('cht_demo_artifact_links')).toBeNull();
        expect(
            listMessages(developmentChatDemoIds.demo).messages.map((message) => message.id)
        ).toContain('msg_demo_artifact_links_request');
    });

    it('soft-deletes a response and projects a history change', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_cmd_1',
            metadata: { runtime: { agentId: 'agt_primary', source: 'command' } },
            participant_id: 'agt_primary',
            status: 'completed',
        });

        const receipt = deleteResponse('rsp_cmd_1');

        expect(receipt.response_id).toBe('rsp_cmd_1');
        expect(getResponse('rsp_cmd_1')?.deleted_at).toBe(receipt.deleted_at);
        expect(listResponses('cht_1').responses[0]?.deleted_at).toBe(receipt.deleted_at);
        expect(listEvents().events.map((event) => event.type)).toContain('response.deleted');
        // Retired pre-flip event shapes no longer project (ADR 0014).
        expect(listProjectedTavernRuntimeEvents().map((entry) => entry.event.type)).not.toContain(
            'chat.historyChanged'
        );
    });

    it('skips retained legacy message deletion events after an upgrade', () => {
        createChat({ id: 'cht_legacy_delete' });
        insertEvent(
            {
                chatId: 'cht_legacy_delete',
                event: 'message.deleted' as TavernChatEvent['type'],
                payload: { message_id: 'msg_legacy' },
            },
            getDb()
        );

        // Retired pre-flip event shapes are skipped rather than bricking
        // catch-up (ADR 0014).
        expect(listProjectedTavernRuntimeEvents()).toEqual([]);
    });

    it('projects agent API posts as chat history changes', () => {
        createChat({ id: 'cht_agent_api_post' });
        createMessage('cht_agent_api_post', {
            author_id: 'agt_primary',
            content: 'posted from the agent CLI',
            id: 'msg_agent_api_post',
            metadata: { runtime: { agentId: 'agt_primary', source: 'agent-api' } },
            role: 'assistant',
        });

        expect(listProjectedTavernRuntimeEvents()).toContainEqual(
            expect.objectContaining({
                event: expect.objectContaining({
                    chatId: 'cht_agent_api_post',
                    type: 'chat.historyChanged',
                }),
            })
        );
    });

    it('projects thread notices as chat history changes', () => {
        createChat({ id: 'cht_thread_notice' });
        createMessage('cht_thread_notice', {
            author_id: 'sys_thread_notice',
            content: '@Otto unfollowed this thread — done here',
            id: 'msg_thread_notice',
            metadata: { runtime: { agentId: 'agt_otto', source: 'thread-notice' } },
            role: 'system',
        });

        expect(listProjectedTavernRuntimeEvents()).toContainEqual(
            expect.objectContaining({
                event: expect.objectContaining({
                    chatId: 'cht_thread_notice',
                    type: 'chat.historyChanged',
                }),
            })
        );
    });

    it('rejects deleting a response that does not exist', () => {
        createChat({ id: 'cht_1' });

        expect(() => deleteResponse('rsp_missing')).toThrow('Missing chat response');
    });

    it('clears a chat by soft-deleting everything currently in it', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_primary',
            status: 'completed',
        });

        const receipt = clearChat('cht_1');

        expect(receipt.messages_deleted).toBe(1);
        expect(receipt.responses_deleted).toBe(1);
        expect(listMessages('cht_1').messages[0]?.deleted_at).toBe(receipt.cleared_at);
        expect(listResponses('cht_1').responses[0]?.deleted_at).toBe(receipt.cleared_at);
        expect(listEvents().events.map((event) => event.type)).toContain('chat.cleared');

        // Sequence slots stay stable, new work after the clear is visible,
        // and a repeat clear does not re-delete already-hidden rows.
        const after = createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'after'));
        expect(after.message.sequence).toBe(2);
        expect(after.message.deleted_at).toBeNull();

        const repeat = clearChat('cht_1');
        expect(repeat.messages_deleted).toBe(1);
        expect(repeat.responses_deleted).toBe(0);
    });

    it('creates messages with per-chat sequence, events, and idempotent nonce receipts', () => {
        createChat({ id: 'cht_1', title: 'Test' });
        const first = createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        const replay = createMessage('cht_1', messageInput('msg_retry', 'nonce_1', 'hello'));
        const second = createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'again'));

        expect(first.idempotent).toBe(false);
        expect(replay.idempotent).toBe(true);
        expect(replay.message.id).toBe('msg_1');
        expect(first.message.sequence).toBe(1);
        expect(second.message.sequence).toBe(2);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'message.created',
        ]);
    });

    it('rejects nonce reuse for a different durable message shape', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));

        expect(() => createMessage('cht_1', messageInput('msg_2', 'nonce_1', 'different'))).toThrow(
            'already used'
        );
    });

    it('rejects malformed Tavern product ids at the write boundary', () => {
        expect(() => createChat({ id: 'chat-1' })).toThrow('Chat id must use a cht_ id.');

        createChat({ id: 'cht_1' });

        expect(() => createMessage('cht_1', messageInput('message-1', 'nonce_1', 'hello'))).toThrow(
            'Message id must use a msg_ id.'
        );
        expect(() =>
            createDelivery('cht_1', {
                agent_id: 'main',
                id: 'delivery-1',
                message: {
                    ...messageInput('msg_1', undefined, 'done'),
                    author_id: 'agt_1',
                    role: 'assistant',
                },
                turn_id: 'turn-1',
            })
        ).toThrow('Delivery id must use a del_ id.');
        expect(() =>
            upsertResponse('cht_1', {
                id: 'response-1',
                participant_id: 'agt_1',
                status: 'running',
            })
        ).toThrow('Response id must use a rsp_ id.');
    });

    it('creates and reads channel and DM chats with participants', () => {
        createChat({
            id: 'cht_channel',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                { id: 'agt_primary', kind: 'agent', label: 'Tavern', metadata: {} },
            ],
            title: 'general',
        });
        createChat({
            id: 'cht_dm',
            kind: 'dm',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                { id: 'agt_primary', kind: 'agent', label: 'Tavern', metadata: {} },
            ],
            title: 'Tavern',
        });

        expect(getChat('cht_channel')).toMatchObject({
            id: 'cht_channel',
            kind: 'channel',
            participants: [
                { id: 'agt_primary', kind: 'agent', label: 'Tavern' },
                { id: 'usr_tavern', kind: 'user', label: 'You' },
            ],
            title: 'general',
        });
        expect(getChat('cht_dm')).toMatchObject({
            id: 'cht_dm',
            kind: 'dm',
            title: 'Tavern',
        });
        expect(() =>
            createChat({
                id: 'cht_bad_dm',
                kind: 'dm',
                participants: [{ id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} }],
            })
        ).toThrow('A DM chat must have exactly two participants.');
    });

    it('projects active chat state from durable queued and running responses', () => {
        createChat({ id: 'cht_1', title: 'Test' });

        expect(getChat('cht_1')).toMatchObject({ active_turn_participant_ids: [] });
        expect(listChats().chats).toEqual([
            expect.objectContaining({ active_turn_participant_ids: [], id: 'cht_1' }),
        ]);

        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'queued',
        });

        expect(getChat('cht_1')).toMatchObject({ active_turn_participant_ids: ['agt_1'] });
        expect(listChats().chats).toEqual([
            expect.objectContaining({ active_turn_participant_ids: ['agt_1'], id: 'cht_1' }),
        ]);

        upsertResponse('cht_1', {
            id: 'rsp_2',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponse('cht_1', {
            id: 'rsp_3',
            participant_id: 'agt_2',
            status: 'running',
        });

        expect(getChat('cht_1')).toMatchObject({
            active_turn_participant_ids: ['agt_1', 'agt_2'],
        });

        upsertResponse('cht_1', {
            completed_at: '2026-07-02T19:12:37.495Z',
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'completed',
        });
        upsertResponse('cht_1', {
            completed_at: '2026-07-02T19:12:37.495Z',
            id: 'rsp_2',
            participant_id: 'agt_1',
            status: 'completed',
        });
        upsertResponse('cht_1', {
            completed_at: '2026-07-02T19:12:37.495Z',
            id: 'rsp_3',
            participant_id: 'agt_2',
            status: 'completed',
        });

        expect(getChat('cht_1')).toMatchObject({ active_turn_participant_ids: [] });
    });

    it('projects last activity from durable undeleted messages', () => {
        createChat({ id: 'cht_1', title: 'Test' });

        expect(getChat('cht_1')).toMatchObject({ last_activity_at: null });
        expect(listChats().chats).toEqual([
            expect.objectContaining({ id: 'cht_1', last_activity_at: null }),
        ]);

        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        const second = createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'again'));

        expect(getChat('cht_1')).toMatchObject({
            last_activity_at: second.message.created_at,
        });
        expect(listChats().chats).toEqual([
            expect.objectContaining({
                id: 'cht_1',
                last_activity_at: second.message.created_at,
            }),
        ]);

        createChat({ id: 'cht_1', title: 'Renamed' });
        expect(getChat('cht_1')).toMatchObject({
            last_activity_at: second.message.created_at,
            title: 'Renamed',
        });
    });

    it('does not treat deleted or delivered responses as active chat state', () => {
        createChat({ id: 'cht_1', title: 'Test' });
        createMessage('cht_1', {
            author_id: 'agt_1',
            content: 'Done',
            id: 'msg_1',
            role: 'assistant',
        });
        upsertResponse('cht_1', {
            id: 'rsp_delivered',
            participant_id: 'agt_1',
            response_message_id: 'msg_1',
            status: 'running',
        });
        upsertResponse('cht_1', {
            id: 'rsp_deleted',
            participant_id: 'agt_1',
            status: 'running',
        });
        deleteResponse('rsp_deleted');

        expect(getChat('cht_1')).toMatchObject({ active_turn_participant_ids: [] });
        expect(listChats().chats).toEqual([
            expect.objectContaining({ active_turn_participant_ids: [], id: 'cht_1' }),
        ]);
    });

    it('bootstraps the agent DM without a default channel', () => {
        const first = seedWorkspaceChats({
            agents: [{ id: 'agt_tavern_12345678', name: 'Tavern' }],
            db: getDb(),
        });
        const second = seedWorkspaceChats({
            agents: [{ id: 'agt_tavern_12345678', name: 'Tavern' }],
            db: getDb(),
        });

        expect(first.seeded).toBe(1);
        expect(second.seeded).toBe(0);
        expect(getChat('cht_general')).toBeNull();
        expect(getChat('cht_agt_tavern_12345678_dm')).toMatchObject({
            id: 'cht_agt_tavern_12345678_dm',
            kind: 'dm',
            participants: [
                { id: 'agt_tavern_12345678', kind: 'agent', label: 'Tavern' },
                { id: localHumanParticipantId, kind: 'user', label: 'You' },
            ],
            title: 'Tavern',
        });
    });

    it('bootstraps one agent DM for each managed agent', () => {
        const first = seedWorkspaceChats({
            agents: [
                { id: 'agt_tavern_12345678', name: 'Tavern' },
                { id: 'agt_research', name: 'Research' },
            ],
            db: getDb(),
        });
        const second = seedWorkspaceChats({
            agents: [
                { id: 'agt_tavern_12345678', name: 'Tavern' },
                { id: 'agt_research', name: 'Research' },
            ],
            db: getDb(),
        });

        expect(first.seeded).toBe(2);
        expect(second.seeded).toBe(0);
        expect(
            listChats()
                .chats.map((chat) => ({ id: chat.id, kind: chat.kind, title: chat.title }))
                .sort((left, right) => left.id.localeCompare(right.id))
        ).toEqual([
            { id: 'cht_agt_research_dm', kind: 'dm', title: 'Research' },
            { id: 'cht_agt_tavern_12345678_dm', kind: 'dm', title: 'Tavern' },
        ]);
    });

    it('writes delivery, assistant message, and delivered event in one receipt', () => {
        createChat({ id: 'cht_1' });
        const receipt = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_1',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });

        expect(receipt.message.role).toBe('assistant');
        expect(listMessages('cht_1').messages).toHaveLength(1);
        expect(listEvents().events.at(-1)?.type).toBe('message.delivered');
    });

    it('searches canonical chat messages by content within one chat', () => {
        createChat({ id: 'cht_1' });
        createChat({ id: 'cht_2' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'podcast note'));
        createMessage('cht_1', messageInput('msg_2', 'nonce_2', 'finance note'));
        createMessage('cht_1', messageInput('msg_3', 'nonce_3', 'Podcast follow-up'));
        createMessage('cht_2', messageInput('msg_4', 'nonce_4', 'podcast in another chat'));

        expect(searchMessages('cht_1', { limit: 10, query: 'podcast' }).messages).toMatchObject([
            { id: 'msg_3', sequence: 3 },
            { id: 'msg_1', sequence: 1 },
        ]);
    });

    it('links repeated assistant delivery receipts to the existing durable message', () => {
        createChat({ id: 'cht_1' });
        const first = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_1',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });
        const replay = createDelivery('cht_1', {
            agent_id: 'agt_1',
            id: 'del_2',
            message: {
                ...messageInput('msg_agt_1', undefined, 'done'),
                author_id: 'agt_1',
                role: 'assistant',
            },
        });

        expect(first.idempotent).toBe(false);
        expect(replay.idempotent).toBe(false);
        expect(replay.message.id).toBe('msg_agt_1');
        expect(replay.message.sequence).toBe(first.message.sequence);
        expect(listMessages('cht_1').messages).toHaveLength(1);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.delivered',
            'message.delivered',
        ]);
    });

    it('stores responses, activity, artifacts, and read state as cursor-backed events', () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        const { response } = upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            request_message_id: 'msg_1',
            status: 'running',
            summary: 'Working',
        });
        const { activity } = upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });
        const { artifact } = upsertArtifact('cht_1', {
            activity_id: 'act_1',
            id: 'art_1',
            kind: 'text',
            response_id: 'rsp_1',
            title: 'Tool output',
        });
        const read = markRead('cht_1', {
            last_read_sequence: 1,
            reader_id: 'usr_1',
        });

        expect(response.summary).toBe('Working');
        expect(activity.title).toBe('Using tool');
        expect(artifact.title).toBe('Tool output');
        expect(read.last_read_sequence).toBe(1);
        expect(listResponses('cht_1').responses).toHaveLength(1);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
        ]);
        expect(listEvents({ recipientId: 'usr_1' }).events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
            'chat.read',
        ]);
        expect(listEvents({ recipientId: 'usr_2' }).events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'activity.created',
            'artifact.created',
        ]);
    });

    it('counts unread for the operator seat and clears via read-to-latest', () => {
        createChat({
            id: 'cht_1',
            participants: [
                // A seeded persona sorts before the operator; the count must
                // still follow the operator's receipt, or a demo chat's pill
                // resurrects after every refetch.
                { id: 'usr_demo', kind: 'user', label: 'Demo', metadata: {} },
                { id: localHumanParticipantId, kind: 'user', label: 'Zach', metadata: {} },
                { id: 'agt_a', kind: 'agent', label: 'Otto', metadata: {} },
            ],
            title: 'Test',
        });
        createMessage('cht_1', {
            author_id: localHumanParticipantId,
            content: 'hi',
            id: 'msg_1',
            role: 'user',
        });
        createMessage('cht_1', {
            author_id: 'usr_demo',
            content: 'seeded line',
            id: 'msg_2',
            role: 'user',
        });
        createMessage('cht_1', {
            author_id: 'agt_a',
            content: 'hello',
            id: 'msg_3',
            role: 'assistant',
        });

        // The operator's own message never counts; everyone else's do.
        expect(getChat('cht_1')?.unread_count).toBe(2);

        // Omitted sequence reads to the latest message.
        const receipt = markRead('cht_1', { reader_id: localHumanParticipantId });
        expect(receipt.last_read_sequence).toBe(3);
        expect(getChat('cht_1')?.unread_count).toBe(0);

        createMessage('cht_1', {
            author_id: 'agt_a',
            content: 'more',
            id: 'msg_4',
            role: 'assistant',
        });
        expect(getChat('cht_1')?.unread_count).toBe(1);
        expect(listChats().chats.find((chat) => chat.id === 'cht_1')?.unread_count).toBe(1);
    });

    it('scopes unread counts and read receipts to each reader', () => {
        createChat({
            id: 'cht_1',
            participants: [
                { id: 'usr_A', kind: 'user', label: 'A', metadata: {} },
                { id: 'usr_B', kind: 'user', label: 'B', metadata: {} },
                { id: 'agt_a', kind: 'agent', label: 'Otto', metadata: {} },
            ],
        });
        createMessage('cht_1', {
            author_id: 'agt_a',
            content: 'first',
            id: 'msg_1',
            role: 'assistant',
        });
        markRead('cht_1', { reader_id: 'usr_A' });
        createMessage('cht_1', {
            author_id: 'agt_a',
            content: 'second',
            id: 'msg_2',
            role: 'assistant',
        });

        expect(listChats({ readerId: 'usr_A' }).chats[0]?.unread_count).toBe(1);
        expect(listChats({ readerId: 'usr_B' }).chats[0]?.unread_count).toBe(2);
        expect(getChat('cht_1', getDb(), 'usr_A')?.unread_count).toBe(1);
        expect(getChat('cht_1', getDb(), 'usr_B')?.unread_count).toBe(2);

        markRead('cht_1', { reader_id: 'usr_A' });

        expect(listChats({ readerId: 'usr_A' }).chats[0]?.unread_count).toBe(0);
        expect(listChats({ readerId: 'usr_B' }).chats[0]?.unread_count).toBe(2);
    });

    it('stores terminal response activity in place', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'running',
            title: 'Using tool',
        });
        const { activity } = upsertResponseActivity('cht_1', 'rsp_1', {
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'act_1',
            kind: 'tool_call',
            started_at: '2026-05-20T12:00:10.000Z',
            status: 'completed',
            title: 'Using tool',
        });

        expect(activity).toMatchObject({
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'act_1',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'completed',
        });
    });

    it('rejects activity ids that already belong to another response', () => {
        createChat({ id: 'cht_1' });
        createChat({ id: 'cht_2' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponse('cht_2', {
            id: 'rsp_2',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'message',
            status: 'running',
            title: 'Assistant reply',
        });

        expect(() =>
            upsertResponseActivity('cht_2', 'rsp_2', {
                id: 'act_1',
                kind: 'message',
                status: 'running',
                title: 'Assistant reply',
            })
        ).toThrow('Activity act_1 belongs to response rsp_1 in chat cht_1.');
    });

    it('closes open activity when the response becomes terminal', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'message',
            started_at: '2026-05-20T12:00:00.000Z',
            status: 'running',
            title: 'Assistant reply',
        });

        upsertResponse('cht_1', {
            completed_at: '2026-05-20T12:00:10.000Z',
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'completed',
        });

        expect(listResponses('cht_1').activity).toMatchObject([
            {
                completed_at: expect.any(String),
                id: 'act_1',
                status: 'completed',
            },
        ]);
    });

    it('keeps response pagination stable when activity updates touch older responses', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponse('cht_1', {
            id: 'rsp_2',
            participant_id: 'agt_1',
            status: 'running',
        });

        const firstPage = listResponses('cht_1', { limit: 1 });

        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });
        getDb()
            .prepare(
                "UPDATE chat_responses SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = 'rsp_1'"
            )
            .run();

        expect(firstPage.responses.map((response) => response.id)).toEqual(['rsp_1']);
        expect(
            listResponses('cht_1', {
                afterSequence: firstPage.next_sequence ?? 0,
                limit: 1,
            }).responses.map((response) => response.id)
        ).toEqual(['rsp_2']);
    });

    it('does not terminalize the parent response when activity completes or fails', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'queued',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'completed',
            title: 'Used tool',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_2',
            kind: 'tool_call',
            status: 'failed',
            title: 'Used other tool',
        });

        expect(getResponse('rsp_1')).toMatchObject({
            completed_at: null,
            id: 'rsp_1',
            status: 'running',
        });
    });

    it('gets response activity by stable id', () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });

        expect(getResponseActivity('act_1')).toMatchObject({
            chat_id: 'cht_1',
            id: 'act_1',
            response_id: 'rsp_1',
            title: 'Using tool',
        });
    });

    it('publishes private read events only to matching recipients', () => {
        const publicEvents: string[] = [];
        const readerEvents: string[] = [];
        const otherEvents: string[] = [];
        const unsubscribers = [
            subscribeToTavernApiEvents((event) => publicEvents.push(event.type)),
            subscribeToTavernApiEvents((event) => readerEvents.push(event.type), {
                recipientId: 'usr_1',
            }),
            subscribeToTavernApiEvents((event) => otherEvents.push(event.type), {
                recipientId: 'usr_2',
            }),
        ];

        try {
            createChat({ id: 'cht_1' });
            createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
            markRead('cht_1', {
                last_read_sequence: 1,
                reader_id: 'usr_1',
            });
        } finally {
            for (const unsubscribe of unsubscribers) {
                unsubscribe();
            }
        }

        expect(publicEvents).toEqual(['message.created']);
        expect(readerEvents).toEqual(['message.created', 'chat.read']);
        expect(otherEvents).toEqual(['message.created']);
    });

    it('keeps durable writes successful when a live event subscriber fails', () => {
        const unsubscribe = subscribeToTavernApiEvents(() => {
            throw new Error('subscriber failed');
        });

        try {
            createChat({ id: 'cht_1' });
            const receipt = createDelivery('cht_1', {
                agent_id: 'agt_1',
                id: 'del_1',
                message: {
                    ...messageInput('msg_agt_1', undefined, 'done'),
                    author_id: 'agt_1',
                    metadata: {
                        runtime: {
                            agentId: 'agt_1',
                            agentSessionId: 'ags_1',
                            runId: 'run_1',
                            source: 'test',
                        },
                    },
                    role: 'assistant',
                },
                turn_id: 'run_1',
            });

            expect(receipt.message.id).toBe('msg_agt_1');
            expect(listMessages('cht_1').messages).toHaveLength(1);
            expect(listEvents().events.at(-1)?.type).toBe('message.delivered');
        } finally {
            unsubscribe();
        }
    });

    it('listEvents visibility parity: public events visible to all, private events only to addressed recipient', () => {
        const db = getDb();
        createChat({ id: 'cht_1' });
        insertEvent({ chatId: 'cht_1', event: 'message.created', payload: { label: 'pub1' } }, db);
        insertEvent(
            {
                chatId: 'cht_1',
                event: 'message.created',
                payload: { label: 'priv-A' },
                private: true,
                recipients: ['A'],
            },
            db
        );
        insertEvent(
            {
                chatId: 'cht_1',
                event: 'message.created',
                payload: { label: 'priv-B' },
                private: true,
                recipients: ['B'],
            },
            db
        );
        insertEvent({ chatId: 'cht_1', event: 'message.created', payload: { label: 'pub2' } }, db);

        const forA = listEvents({ recipientId: 'A' });
        expect(forA.events).toHaveLength(3);
        expect(forA.events.map((e) => (e as Record<string, unknown>).label)).toEqual([
            'pub1',
            'priv-A',
            'pub2',
        ]);

        const forNone = listEvents({});
        expect(forNone.events).toHaveLength(2);
        expect(forNone.events.map((e) => (e as Record<string, unknown>).label)).toEqual([
            'pub1',
            'pub2',
        ]);
    });

    it('listEvents limit and next_cursor: pages correctly across visible events', () => {
        const db = getDb();
        createChat({ id: 'cht_1' });
        const limit = 3;
        for (let i = 1; i <= limit + 2; i++) {
            insertEvent({ chatId: 'cht_1', event: 'message.created', payload: { seq: i } }, db);
        }

        const page1 = listEvents({ limit });
        expect(page1.events).toHaveLength(limit);
        expect(page1.next_cursor).toBe(page1.events.at(-1)?.cursor ?? null);
        expect(page1.next_cursor).not.toBeNull();

        const page2 = listEvents({ limit, afterCursor: page1.next_cursor });
        expect(page2.events).toHaveLength(2);
        expect(page2.next_cursor).toBeNull();
    });

    it('listEvents private events do not consume the page: skipped in SQL, not counted against limit', () => {
        const db = getDb();
        createChat({ id: 'cht_1' });
        for (let i = 0; i < 5; i++) {
            insertEvent(
                {
                    chatId: 'cht_1',
                    event: 'message.created',
                    payload: { seq: i },
                    private: true,
                    recipients: ['other'],
                },
                db
            );
        }
        for (let i = 0; i < 3; i++) {
            insertEvent({ chatId: 'cht_1', event: 'message.created', payload: { seq: i } }, db);
        }

        const result = listEvents({ limit: 3 });
        expect(result.events).toHaveLength(3);
        expect(result.next_cursor).toBeNull();
    });
});

describe('Tavern Runtime Chat API routes', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('returns OpenAPI-shaped route payloads', async () => {
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats', {
                id: 'cht_1',
                title: 'Test',
            })
        );
        const response = await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'hello')
            )
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            idempotent: false,
            message: {
                chat_id: 'cht_1',
                id: 'msg_1',
                sequence: 1,
            },
        });

        const replay = await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_retry', 'nonce_1', 'hello')
            )
        );

        expect(replay.status).toBe(200);
        await expect(replay.json()).resolves.toMatchObject({
            idempotent: true,
            message: {
                id: 'msg_1',
                sequence: 1,
            },
        });
    });

    it('reads list and detail unread counts for the requested reader', async () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', {
            author_id: 'agt_1',
            content: 'hello',
            id: 'msg_1',
            role: 'assistant',
        });
        markRead('cht_1', { reader_id: 'usr_A' });

        const listResponse = await handleTavernRuntimeRequest(
            getRequest('/api/chats?reader_id=usr_A')
        );
        const detailResponse = await handleTavernRuntimeRequest(
            getRequest('/api/chats/cht_1?reader_id=usr_B')
        );

        await expect(listResponse.json()).resolves.toMatchObject({
            chats: [{ id: 'cht_1', unread_count: 0 }],
        });
        await expect(detailResponse.json()).resolves.toMatchObject({
            id: 'cht_1',
            unread_count: 1,
        });
    });

    it('soft-deletes responses and clears chats through the chat API routes', async () => {
        createChat({ id: 'cht_1' });
        createMessage('cht_1', messageInput('msg_1', 'nonce_1', 'hello'));
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'completed',
        });

        const deleted = await handleTavernRuntimeRequest(
            new Request('http://127.0.0.1:18790/api/responses/rsp_1', { method: 'DELETE' })
        );
        expect(deleted.status).toBe(200);
        await expect(deleted.json()).resolves.toMatchObject({ response_id: 'rsp_1' });

        const cleared = await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats/cht_1/clear', {})
        );
        expect(cleared.status).toBe(200);
        await expect(cleared.json()).resolves.toMatchObject({
            chat_id: 'cht_1',
            messages_deleted: 1,
            responses_deleted: 0,
        });
    });

    it('gets durable response activity through the chat API route', async () => {
        createChat({ id: 'cht_1' });
        upsertResponse('cht_1', {
            id: 'rsp_1',
            participant_id: 'agt_1',
            status: 'running',
        });
        upsertResponseActivity('cht_1', 'rsp_1', {
            id: 'act_1',
            kind: 'tool_call',
            status: 'running',
            title: 'Using tool',
        });

        const response = await handleTavernRuntimeRequest(
            getRequest('/api/chats/cht_1/activity/act_1')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            chat_id: 'cht_1',
            id: 'act_1',
            response_id: 'rsp_1',
            title: 'Using tool',
        });
    });

    it('searches durable messages through the chat API route', async () => {
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats', { id: 'cht_1', title: 'test' })
        );
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'save this podcast takeaway')
            )
        );
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_2', 'nonce_2', 'unrelated note')
            )
        );

        const response = await handleTavernRuntimeRequest(
            getRequest('/api/chats/cht_1/messages/search?query=podcast&limit=5')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            messages: [{ id: 'msg_1', content: 'save this podcast takeaway', sequence: 1 }],
            next_sequence: null,
        });
    });

    it('filters private event lists by recipient', async () => {
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats', { id: 'cht_1', title: 'test' })
        );
        await handleTavernRuntimeRequest(
            jsonRequest(
                'POST',
                '/api/chats/cht_1/messages',
                messageInput('msg_1', 'nonce_1', 'hello')
            )
        );
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats/cht_1/read', {
                last_read_sequence: 1,
                reader_id: 'usr_1',
            })
        );

        const otherRecipient = await handleTavernRuntimeRequest(
            getRequest('/api/events?recipient_id=usr_2')
        );
        await expect(otherRecipient.json()).resolves.toMatchObject({
            events: [{ type: 'message.created' }],
        });

        const readerRecipient = await handleTavernRuntimeRequest(
            getRequest('/api/events?recipient_id=usr_1')
        );
        await expect(readerRecipient.json()).resolves.toMatchObject({
            events: [{ type: 'message.created' }, { type: 'chat.read' }],
        });
    });

    it('returns runtime projection events from the durable chat event log', async () => {
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats', { id: 'cht_1', title: 'test' })
        );
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats/cht_1/messages', {
                ...messageInput('msg_1', 'nonce_1', 'hello'),
                metadata: {
                    runtime: {
                        agentId: 'agt_1',
                        agentSessionId: 'ags_1',
                        runId: 'run_1',
                    },
                },
            })
        );

        const response = await handleTavernRuntimeRequest(getRequest(runtimeRoutes.events));

        await expect(response.json()).resolves.toMatchObject({
            events: [
                {
                    chatId: 'cht_1',
                    message: {
                        id: 'msg_1',
                        sequence: 1,
                        text: 'hello',
                    },
                    type: 'chat.messageAccepted',
                },
            ],
        });
    });

    it('filters runtime projection events after a durable cursor', async () => {
        await handleTavernRuntimeRequest(
            jsonRequest('POST', '/api/chats', { id: 'cht_1', title: 'test' })
        );
        for (const index of [1, 2]) {
            await handleTavernRuntimeRequest(
                jsonRequest('POST', '/api/chats/cht_1/messages', {
                    ...messageInput(`msg_${index}`, `nonce_${index}`, `hello ${index}`),
                    metadata: {
                        runtime: {
                            agentId: 'agt_1',
                            agentSessionId: 'ags_1',
                            runId: `run_${index}`,
                        },
                    },
                })
            );
        }

        const response = await handleTavernRuntimeRequest(
            getRequest(`${runtimeRoutes.events}?after_cursor=1`)
        );

        await expect(response.json()).resolves.toMatchObject({
            events: [{ message: { id: 'msg_2' }, type: 'chat.messageAccepted' }],
        });
    });
});

function createChat(input: TavernCreateChatRequest) {
    const kind = input.kind ?? 'channel';
    return createRuntimeChat({
        ...input,
        ...(kind === 'channel' && !input.title ? { title: input.id.replace(/^cht_/u, '') } : {}),
    });
}

function messageInput(id: string, nonce: string | undefined, content: string) {
    return {
        author_id: 'usr_1',
        content,
        id,
        ...(nonce ? { nonce } : {}),
        role: 'user' as const,
    };
}

function jsonRequest(method: string, path: string, body: unknown) {
    return new Request(`http://127.0.0.1:18790${path}`, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method,
    });
}

function getRequest(path: string) {
    return new Request(`http://127.0.0.1:18790${path}`);
}
