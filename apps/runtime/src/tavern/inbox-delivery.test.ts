import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { listMutedChannelIds } from './agent-attention.ts';
import {
    joinAgentChannel,
    leaveAgentChannel,
    muteAgentChannel,
    unmuteAgentChannel,
} from './agent-channels.ts';
import { checkAgentInbox, checkAgentMessages } from './agent-inbox-api.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import { createChat, createMessage, ensureThreadChat, setThreadFollow } from './chat-api/index.ts';
import { planMessageDelivery, registerInboxWakeSink } from './delivery-planner.ts';
import {
    advanceDeliveredCursor,
    advanceSeenCursor,
    listInboxPierces,
    listPendingInboxTargets,
    readInboxCursor,
} from './inbox-cursors.ts';
import { composeDrainDelivery } from './inbox-drain.ts';
import {
    composeInboxNotice,
    rememberNoticeFingerprints,
    resetInboxNoticesForTesting,
} from './inbox-notices.ts';
import { readServedCursor } from './served-ledger.ts';

const ottoId = 'agt_otto';
const wrenId = 'agt_wren';

describe('inbox delivery (I1/I2/I3)', () => {
    const woken: string[] = [];

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        resetInboxNoticesForTesting();
        woken.length = 0;
        registerInboxWakeSink({ wakeAgent: (agentId) => woken.push(agentId) });
        seedAgents();
        seedGeneral();
    });

    afterEach(() => {
        registerInboxWakeSink(null);
        closeDb();
    });

    it('advances delivered for member agents and never for the author', () => {
        const message = sendHuman('hello everyone');
        planMessageDelivery('cht_general', message);

        const otto = sessionFor(ottoId);
        const wren = sessionFor(wrenId);
        expect(readInboxCursor(otto.id, 'cht_general').deliveredUpToSeq).toBe(message.sequence);
        expect(readInboxCursor(wren.id, 'cht_general').deliveredUpToSeq).toBe(message.sequence);
        expect(woken).toContain(ottoId);
        expect(woken).toContain(wrenId);

        const reply = sendAgent(ottoId, 'hi!');
        planMessageDelivery('cht_general', reply);
        expect(readInboxCursor(otto.id, 'cht_general').deliveredUpToSeq).toBe(message.sequence);
        expect(readInboxCursor(wren.id, 'cht_general').deliveredUpToSeq).toBe(reply.sequence);
    });

    it('never delivers a channel message to an agent that is not a member', () => {
        // Membership fan-out is a security invariant (WS6 carries it over a
        // network hop unchanged): a stored agent outside the participant list
        // gets no delivery, no wake, and no pierce — even when mentioned.
        const irisId = 'agt_iris';
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: irisId,
                isAdmin: false,
                name: 'Iris',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_iris',
            },
        });
        const iris = sessionFor(irisId);

        const mention = sendHuman('paging @Iris even though she is not here');
        planMessageDelivery('cht_general', mention);

        expect(readInboxCursor(iris.id, 'cht_general').deliveredUpToSeq).toBe(0);
        expect(listInboxPierces(iris.id)).toEqual([]);
        expect(listPendingInboxTargets(iris.id)).toEqual([]);
        expect(woken).not.toContain(irisId);
        // Members still received the same message normally.
        expect(readInboxCursor(sessionFor(ottoId).id, 'cht_general').deliveredUpToSeq).toBe(
            mention.sequence
        );
    });

    it('freezes delivered on muted channels and pierces personal mentions only', () => {
        muteAgentChannel(ottoId, { target: '#general' });

        const plain = sendHuman('no mention here');
        planMessageDelivery('cht_general', plain);
        const otto = sessionFor(ottoId);
        expect(readInboxCursor(otto.id, 'cht_general').deliveredUpToSeq).toBe(0);
        expect(listInboxPierces(otto.id)).toEqual([]);

        const mention = sendHuman('hey @Otto can you look?');
        planMessageDelivery('cht_general', mention);
        expect(readInboxCursor(otto.id, 'cht_general').deliveredUpToSeq).toBe(0);
        expect(listInboxPierces(otto.id)).toEqual([
            { chatId: 'cht_general', messageId: mention.id },
        ]);

        unmuteAgentChannel(ottoId, { target: '#general' });
        expect(listMutedChannelIds(ottoId)).toEqual([]);
    });

    it('delivers thread messages to followers only', () => {
        const anchor = sendHuman('anchor message');
        const thread = ensureThreadChat({
            anchorMessageId: anchor.id,
            parentChatId: 'cht_general',
        });
        setThreadFollow({
            follow: true,
            participantId: createAgentParticipantId(ottoId),
            threadChatId: thread.id,
        });

        const reply = createMessage(thread.id, {
            author_id: 'usr_tavern',
            content: 'thread reply',
            id: createMessageId(),
            role: 'user',
        }).message;
        planMessageDelivery(thread.id, reply);

        expect(readInboxCursor(sessionFor(ottoId).id, thread.id).deliveredUpToSeq).toBe(
            reply.sequence
        );
        expect(readInboxCursor(sessionFor(wrenId).id, thread.id).deliveredUpToSeq).toBe(0);
    });

    it('composes one batched drain with the verbatim trailer and seq proofs', () => {
        const first = sendHuman('first');
        const second = sendHuman('second');
        planMessageDelivery('cht_general', first);
        planMessageDelivery('cht_general', second);

        const delivery = composeDrainDelivery({
            agentId: ottoId,
            sessionId: sessionFor(ottoId).id,
        });
        expect(delivery).not.toBeNull();
        expect(delivery?.prompt.startsWith('New messages received:\n\n')).toBe(true);
        expect(delivery?.prompt).toContain('[target=#general msg=');
        expect(delivery?.prompt).toContain('@zach: first');
        expect(
            delivery?.prompt.endsWith(
                "Respond as appropriate. Complete all your work before stopping.\nReply in the channel or create/reply in a thread as appropriate; use each message's `target` and `msg` fields to choose the exact target."
            )
        ).toBe(true);
        expect(delivery?.embeddedSeqByChatId.get('cht_general')).toBe(second.sequence);
        expect(delivery?.hasHumanEnvelope).toBe(true);
    });

    it('drains an over-limit backlog oldest-first without skipping rows', () => {
        const messages = Array.from({ length: 45 }, (_, index) => {
            const message = sendHuman(`backlog ${index + 1}`);
            planMessageDelivery('cht_general', message);
            return message;
        });
        const session = sessionFor(ottoId);

        const first = composeDrainDelivery({ agentId: ottoId, sessionId: session.id });
        expect(first?.envelopeCount).toBe(40);
        expect(first?.prompt).toContain('backlog 1');
        expect(first?.prompt).toContain('backlog 40');
        expect(first?.prompt).not.toContain('backlog 41');
        expect(first?.embeddedSeqByChatId.get('cht_general')).toBe(messages[39]?.sequence);

        advanceSeenCursor({
            chatId: 'cht_general',
            seq: messages[39]?.sequence ?? 0,
            sessionId: session.id,
        });
        const second = composeDrainDelivery({ agentId: ottoId, sessionId: session.id });
        expect(second?.envelopeCount).toBe(5);
        expect(second?.prompt).toContain('backlog 41');
        expect(second?.prompt).toContain('backlog 45');
        expect(second?.embeddedSeqByChatId.get('cht_general')).toBe(messages[44]?.sequence);
    });

    it('applies the drain limit after filtering undeliverable rows', () => {
        for (let index = 0; index < 20; index += 1) {
            sendHuman(`deleted ${index + 1}`);
        }
        for (let index = 0; index < 20; index += 1) {
            sendAgent(ottoId, `self ${index + 1}`);
        }
        const live = sendHuman('newer live message');
        const session = sessionFor(ottoId);
        getDb()
            .prepare(
                `UPDATE chat_messages
                 SET deleted_at = '2026-07-22T00:00:00.000Z'
                 WHERE chat_id = 'cht_general' AND sequence <= 20`
            )
            .run();
        advanceDeliveredCursor({
            chatId: 'cht_general',
            seq: live.sequence,
            sessionId: session.id,
        });

        const delivery = composeDrainDelivery({ agentId: ottoId, sessionId: session.id });

        expect(delivery?.envelopeCount).toBe(1);
        expect(delivery?.prompt).toContain('newer live message');
        expect(delivery?.embeddedSeqByChatId.get('cht_general')).toBe(live.sequence);
    });

    it('uses the singular header for one envelope', () => {
        const only = sendHuman('just one');
        planMessageDelivery('cht_general', only);
        const delivery = composeDrainDelivery({
            agentId: ottoId,
            sessionId: sessionFor(ottoId).id,
        });
        expect(delivery?.prompt.startsWith('New message received:\n\n')).toBe(true);
    });

    it('notices are content-free and advance no cursor (I3 wake proof)', () => {
        const message = sendHuman('secret body text');
        planMessageDelivery('cht_general', message);
        const otto = sessionFor(ottoId);
        const before = readInboxCursor(otto.id, 'cht_general');

        const notice = composeInboxNotice({ agentId: ottoId, runId: 'run_test' });
        expect(notice?.text).toContain('[Grotto inbox notice:');
        expect(notice?.text).toContain('Inbox update: 1 unread message total; 1 changed target(s)');
        expect(notice?.text).toContain('#general  pending: 1 message(s) · first msg=');
        expect(notice?.text).not.toContain('secret body text');

        const after = readInboxCursor(otto.id, 'cht_general');
        expect(after).toEqual(before);
        expect(readServedCursor(otto.id, 'cht_general')).toBe(0);
    });

    it('repeats a notice only when the pending state changes', () => {
        const first = sendHuman('one');
        planMessageDelivery('cht_general', first);
        const compose = () => composeInboxNotice({ agentId: ottoId, runId: 'run_x' });
        const initial = compose();
        expect(initial).not.toBeNull();
        // The fingerprint is remembered only when a notice is delivered.
        rememberNoticeFingerprints('run_x', initial?.fingerprints ?? new Map());
        expect(compose()).toBeNull();

        const second = sendHuman('two');
        planMessageDelivery('cht_general', second);
        expect(compose()?.text).toContain('pending: 2 message(s)');
    });

    it('message check serves envelopes, advances served only, and clears pierces', () => {
        muteAgentChannel(ottoId, { target: '#general' });
        const mention = sendHuman('ping @Otto');
        planMessageDelivery('cht_general', mention);

        const result = checkAgentMessages(ottoId);
        expect(result.more).toBe(false);
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.target).toBe('#general');

        const otto = sessionFor(ottoId);
        expect(readServedCursor(otto.id, 'cht_general')).toBe(mention.sequence);
        expect(readInboxCursor(otto.id, 'cht_general').seenUpToSeq).toBe(0);
        expect(listInboxPierces(otto.id)).toEqual([]);
    });

    it('inbox check summarizes pending targets with tags', () => {
        const message = sendHuman('mentioning @Otto here');
        planMessageDelivery('cht_general', message);

        const result = checkAgentInbox(ottoId);
        expect(result.totalPending).toBe(1);
        expect(result.rows[0]).toMatchObject({
            dm: false,
            mentioned: true,
            pendingCount: 1,
            target: '#general',
            thread: false,
        });
        expect(listPendingInboxTargets(sessionFor(ottoId).id)).toHaveLength(1);
    });

    it('join and leave manage the channel seat', () => {
        createChat({
            id: 'cht_lounge',
            kind: 'channel',
            participants: [{ id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} }],
            title: 'lounge',
        });
        joinAgentChannel(ottoId, { target: '#lounge' });
        const joined = sendHuman('welcome', 'cht_lounge');
        planMessageDelivery('cht_lounge', joined);
        expect(readInboxCursor(sessionFor(ottoId).id, 'cht_lounge').deliveredUpToSeq).toBe(
            joined.sequence
        );

        leaveAgentChannel(ottoId, { target: '#lounge' });
        const afterLeave = sendHuman('gone now', 'cht_lounge');
        planMessageDelivery('cht_lounge', afterLeave);
        expect(readInboxCursor(sessionFor(ottoId).id, 'cht_lounge').deliveredUpToSeq).toBe(
            joined.sequence
        );
    });

    function sessionFor(agentId: string) {
        return ensureCurrentAgentSession({ agentId });
    }
});

function seedAgents() {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: ottoId,
            isAdmin: false,
            name: 'Otto',
            primaryColor: null,
            workspaceFolder: '/tmp/agt_otto',
        },
    });
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: wrenId,
            isAdmin: false,
            name: 'Wren',
            primaryColor: null,
            workspaceFolder: '/tmp/agt_wren',
        },
    });
    getDb()
        .prepare(
            `INSERT OR IGNORE INTO identity_users (id, clerk_user_id, name, created_at, updated_at)
             VALUES ('usr_tavern', 'clerk_test', 'zach', $now, $now)`
        )
        .run({ $now: new Date().toISOString() });
}

function seedGeneral() {
    createChat({
        id: 'cht_general',
        kind: 'channel',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'zach', metadata: {} },
            {
                id: createAgentParticipantId(ottoId),
                kind: 'agent',
                label: 'Otto',
                metadata: { agentId: ottoId },
            },
            {
                id: createAgentParticipantId(wrenId),
                kind: 'agent',
                label: 'Wren',
                metadata: { agentId: wrenId },
            },
        ],
        title: 'general',
    });
}

function sendHuman(content: string, chatId = 'cht_general') {
    return createMessage(chatId, {
        author_id: 'usr_tavern',
        content,
        id: createMessageId(),
        role: 'user',
    }).message;
}

function sendAgent(agentId: string, content: string) {
    return createMessage('cht_general', {
        author_id: createAgentParticipantId(agentId),
        content,
        id: createMessageId(),
        role: 'assistant',
    }).message;
}
