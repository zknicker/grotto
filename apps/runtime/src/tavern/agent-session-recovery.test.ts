import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { AgentSessionResumeRejectedError } from './agent-executor.ts';
import {
    ensureCurrentAgentSession,
    readCurrentAgentSession,
    updateAgentSessionRuntimeState,
} from './agent-session-store.ts';
import { mintAgentToken, readAgentToken } from './agent-tokens.ts';
import { restartAgent, setAgentExecutorForTesting, wakeAgent } from './agent-turn-runner.ts';
import { getAgentTurn, listAgentTurnsForSession } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import { createChat, createMessage, listMessages } from './chat-api/index.ts';
import { planMessageDelivery } from './delivery-planner.ts';

const agentId = 'agt_recover';
const dmChatId = 'cht_agt_recover_dm';

describe('agent session resume recovery (specs/sessions.md)', () => {
    let restoreExecutor: (() => void) | undefined;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        restoreExecutor = undefined;
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: agentId,
                isAdmin: false,
                name: 'Recover',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_recover',
            },
        });
        createChat({
            id: 'cht_run',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'zach', metadata: {} },
                {
                    id: createAgentParticipantId(agentId),
                    kind: 'agent',
                    label: 'Recover',
                    metadata: { agentId },
                },
            ],
            title: 'run',
        });
    });

    afterEach(() => {
        restoreExecutor?.();
        closeDb();
    });

    it('rotates one fresh generation and cold-starts once when resume is rejected', async () => {
        const executed = installExecutor((input) =>
            input.agentSession.resumeState
                ? Promise.reject(new AgentSessionResumeRejectedError(input.agentSession.id))
                : Promise.resolve({ contextTokens: 7 })
        );
        const first = seedResumableSession();
        planPending('needs work');

        wakeAgent(agentId);
        await waitFor(() => readCurrentAgentSession({ agentId })?.generation === 2);
        await waitFor(() =>
            listAgentTurnsForSession(first.id).some((turn) => turn.status === 'completed')
        );

        // Exactly one cold start: the rejected attempt plus one retry.
        expect(executed).toHaveLength(2);
        expect(executed[0]?.agentSession.generation).toBe(1);
        expect(executed[1]?.agentSession.generation).toBe(2);
        expect(executed[1]?.prompt.startsWith('Fresh session: earlier runtime context')).toBe(true);
        // The recovery is visible as a receipt directing history + memory.
        expect(recoveryReceipts()).toHaveLength(1);
    });

    it('leaves the agent offline when the single cold start also fails', async () => {
        const executed = installExecutor((input) =>
            input.agentSession.resumeState
                ? Promise.reject(new AgentSessionResumeRejectedError(input.agentSession.id))
                : Promise.reject(new Error('cold start boom'))
        );
        const first = seedResumableSession();
        planPending('needs work');

        wakeAgent(agentId);
        await waitFor(() =>
            listAgentTurnsForSession(first.id).some((turn) => turn.status === 'failed')
        );

        const failed = listAgentTurnsForSession(first.id).find((turn) => turn.status === 'failed');
        expect(getAgentTurn(failed?.id ?? '')?.metadata.error).toContain('cold start boom');
        // Rotated once, not in a loop.
        expect(readCurrentAgentSession({ agentId })?.generation).toBe(2);
        expect(executed).toHaveLength(2);
        expect(recoveryReceipts()).toHaveLength(1);
    });

    it('restart resumes the current session without rotating it, the token, or a receipt', async () => {
        installExecutor(() => Promise.resolve({ contextTokens: 1 }));
        wakeAgent(agentId);
        const session = ensureCurrentAgentSession({ agentId });
        await waitFor(() =>
            listAgentTurnsForSession(session.id).some((turn) => turn.status === 'completed')
        );
        const token = mintAgentToken(agentId);

        const result = await restartAgent(agentId);

        expect(result.stopped).toBe(false);
        expect(result.session.id).toBe(session.id);
        expect(readCurrentAgentSession({ agentId })?.id).toBe(session.id);
        expect(readAgentToken(agentId)).toBe(token);
        expect(recoveryReceipts()).toHaveLength(0);
        expect(newSessionReceipts()).toHaveLength(0);
    });

    function installExecutor(
        execute: (input: {
            agentSession: { generation: number; id: string; resumeState: unknown };
            prompt: string;
        }) => Promise<{ contextTokens: number | null }>
    ) {
        const executed: Array<{
            agentSession: { generation: number; id: string; resumeState: unknown };
            prompt: string;
        }> = [];
        restoreExecutor = setAgentExecutorForTesting({
            execute: (input) => {
                executed.push(input);
                return execute(input);
            },
        });
        return executed;
    }

    function seedResumableSession() {
        const session = ensureCurrentAgentSession({ agentId });
        // A session that ran and stored resume state: the next turn resumes it.
        updateAgentSessionRuntimeState({
            id: session.id,
            resumeState: { engine: 'v1' },
            runtimeSessionId: 'ses_recover_1',
        });
        return ensureCurrentAgentSession({ agentId });
    }

    function planPending(content: string) {
        const message = createMessage('cht_run', {
            author_id: 'usr_tavern',
            content,
            id: createMessageId(),
            role: 'user',
        }).message;
        planMessageDelivery('cht_run', message);
        return message;
    }

    function recoveryReceipts() {
        return systemReceipts().filter((reason) => reason === 'recovery');
    }

    function newSessionReceipts() {
        return systemReceipts();
    }

    function systemReceipts() {
        return listMessages(dmChatId, { limit: 20 })
            .messages.filter((message) => message.role === 'system')
            .map(
                (message) =>
                    (message.metadata as { runtime?: { notice?: string; reason?: string } }).runtime
            )
            .filter((runtime) => runtime?.notice === 'new_session')
            .map((runtime) => runtime?.reason);
    }
});

async function waitFor(check: () => boolean, timeoutMs = 3000) {
    const startedAt = Date.now();
    while (!check()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('Timed out waiting for condition.');
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}
