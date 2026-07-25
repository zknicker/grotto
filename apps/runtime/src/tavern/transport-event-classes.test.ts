import { type AgentRuntimeEvent, runtimeRoutes } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { retractComposition } from './agent-compositions';
import { createChat, createMessage, listEvents } from './chat-api';
import { handleTavernRuntimeRequest } from './router';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection';
import { subscribeToRuntimeEvents } from './runtime-events';

// Transport event classes (specs/raft-alignment/README.md, "Transport
// topology (decided)"): durable events (message.created etc.) are cursor
// -logged and replayable via catch-up; volatile events (compositions) are
// relayed live and never persisted or replayed. WS6 swaps the hop for a
// network transport — these contracts must hold unchanged.

describe('transport event classes', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('relays volatile compositions live without touching the durable event log', () => {
        const live: AgentRuntimeEvent[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => live.push(event));

        try {
            retractComposition({ agentId: 'agt_otto', compositionId: 'cmp_volatile_1' });
        } finally {
            unsubscribe();
        }

        // The composition reached live subscribers with its payload intact...
        expect(live).toEqual([
            expect.objectContaining({
                agentId: 'agt_otto',
                compositionId: 'cmp_volatile_1',
                state: 'retracted',
                type: 'agent.composition',
            }),
        ]);
        // ...and left no durable trace: nothing to replay, nothing to backfill.
        expect(listEvents().events).toEqual([]);
        expect(listProjectedTavernRuntimeEvents()).toEqual([]);
    });

    it('replays durable messages from the cursor log while compositions stay absent', () => {
        createChat({ id: 'cht_transport', kind: 'channel', title: 'transport' });
        const { message } = createMessage('cht_transport', {
            author_id: 'usr_tavern',
            content: 'durable line',
            id: 'msg_durable_1',
            role: 'user',
        });
        retractComposition({ agentId: 'agt_otto', compositionId: 'cmp_volatile_2' });

        // The durable class survives a full re-query from cursor zero.
        expect(listEvents().events.map((event) => event.type)).toEqual(['message.created']);
        expect(listProjectedTavernRuntimeEvents()).toEqual([
            {
                cursor: 1,
                event: expect.objectContaining({
                    chatId: 'cht_transport',
                    message: expect.objectContaining({
                        id: message.id,
                        sequence: message.sequence,
                        text: 'durable line',
                    }),
                    type: 'chat.messageAccepted',
                }),
            },
        ]);
        // A consumer already at the cursor has nothing to refetch — replay is
        // cursor-bounded, not a firehose.
        expect(listProjectedTavernRuntimeEvents({ afterCursor: 1 })).toEqual([]);
    });

    it('serves only durable events on the reconnect catch-up route', async () => {
        createChat({ id: 'cht_transport', kind: 'channel', title: 'transport' });
        createMessage('cht_transport', {
            author_id: 'usr_tavern',
            content: 'missed while offline',
            id: 'msg_missed_1',
            role: 'user',
        });
        retractComposition({ agentId: 'agt_otto', compositionId: 'cmp_volatile_3' });

        // This is the exact route the server hits after re-establishing its
        // runtime connection: missed durable events come back, volatile
        // compositions structurally cannot.
        const response = await handleTavernRuntimeRequest(
            new Request(`http://127.0.0.1:18790${runtimeRoutes.events}`)
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            events: [
                {
                    chatId: 'cht_transport',
                    message: { id: 'msg_missed_1', text: 'missed while offline' },
                    type: 'chat.messageAccepted',
                },
            ],
        });
    });
});
