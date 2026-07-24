import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { ensureCurrentAgentSession, startNewAgentSession } from './agent-session-store';
import { claimNextAgentTurnForAgent, createAgentTurn, getAgentTurn } from './agent-turn-store';
import { upsertStoredAgent } from './agents-store';
import { agentDmChatId } from './bootstrap-chats';
import {
    advanceDeliveredCursor,
    listInboxPierces,
    markInboxPiercesServed,
    recordInboxPierce,
} from './inbox-cursors';
import { recoverInterruptedAgentTurns } from './turn-recovery';

describe('turn recovery', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('finalizes orphaned non-terminal agent turns', () => {
        const agent = storeRecoveryAgent();
        const session = ensureCurrentAgentSession({ agentId: agent.id });
        createAgentTurn({
            agentId: agent.id,
            agentSessionId: session.id,
            id: 'run_stuck',
            kind: 'start',
        });
        claimNextAgentTurnForAgent({ agentId: agent.id });

        const currentSession = startNewAgentSession({ agentId: agent.id });
        expect(currentSession.id).not.toBe(session.id);
        recordInboxPierce({
            chatId: agentDmChatId(agent.id),
            messageId: 'msg_pierce',
            sessionId: currentSession.id,
        });
        markInboxPiercesServed({
            messageIds: ['msg_pierce'],
            runId: 'run_stuck',
            sessionId: currentSession.id,
        });

        const recovery = recoverInterruptedAgentTurns();

        expect(recovery.recoveredTurnCount).toBe(1);
        expect(recovery.agentIdsToWake).toEqual(new Set([agent.id]));
        expect(getAgentTurn('run_stuck')).toMatchObject({
            completedAt: expect.any(String),
            metadata: { error: 'Interrupted by an agent runtime restart.' },
            status: 'failed',
        });
        expect(listInboxPierces(currentSession.id, { excludeServed: true })).toEqual([
            { chatId: agentDmChatId(agent.id), messageId: 'msg_pierce' },
        ]);
    });

    test('requests a wake for queued turns and current-session pending targets', () => {
        const agent = storeRecoveryAgent();
        const session = ensureCurrentAgentSession({ agentId: agent.id });
        createAgentTurn({
            agentId: agent.id,
            agentSessionId: session.id,
            id: 'run_queued',
            kind: 'start',
        });
        advanceDeliveredCursor({ chatId: agentDmChatId(agent.id), seq: 1, sessionId: session.id });

        const recovery = recoverInterruptedAgentTurns();
        expect(recovery.recoveredTurnCount).toBe(0);
        expect(recovery.agentIdsToWake).toEqual(new Set([agent.id]));
        expect(getAgentTurn('run_queued')).toMatchObject({ status: 'queued' });
    });
});

function storeRecoveryAgent() {
    return upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: 'agt_otto_recovery',
            isAdmin: false,
            name: 'Otto',
            primaryColor: null,
            workspaceFolder: '/tmp/tavern-recovery-workspace',
        },
    });
}
