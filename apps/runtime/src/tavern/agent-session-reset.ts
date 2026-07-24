import fs from 'node:fs/promises';
import { closeMcpClientsForAgent } from '../agent-engine/mcp-clients.ts';
import { getDb } from '../db/connection.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { seedAgentWorkspace } from '../workspace/starter-kit.ts';
import { startNewAgentSession } from './agent-session-store.ts';
import { rotateAgentToken } from './agent-tokens.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import { createMessage, listChatsForAgentParticipant } from './chat-api/index.ts';

// Manual reset contract (specs/sessions.md): human-initiated, agent-scoped.
// "Session reset" starts a fresh global session; workspace and memory
// persist. "Full reset" wipes the workspace back to the factory starter kit
// (starter MEMORY.md + practice notes — the same seed a newborn agent gets;
// the creation-time archetype is not stored, so its lane note is not
// re-seeded). Restart needs no Runtime action — turns already resume the
// stored session as-is.

export type AgentResetKind = 'full' | 'session';

export async function resetAgentSession(input: {
    agentId: string;
    kind?: AgentResetKind;
    noticeText?: string;
}) {
    const kind = input.kind ?? 'session';
    if (kind === 'full') {
        await wipeAgentWorkspace(input.agentId);
    }
    await closeMcpClientsForAgent(input.agentId);
    const session = startNewAgentSession({ agentId: input.agentId });
    rotateAgentToken(input.agentId);
    recordSessionResetNotice({
        agentId: input.agentId,
        sessionId: session.id,
        text:
            input.noticeText ??
            (kind === 'full'
                ? 'Started completely fresh: new session and a factory-fresh workspace.'
                : 'Started a fresh session. New messages start with fresh context.'),
    });
    return { session };
}

async function wipeAgentWorkspace(agentId: string) {
    const agent = getStoredAgent(agentId);
    if (!agent?.workspaceFolder) {
        return;
    }
    await fs.rm(agent.workspaceFolder, { force: true, recursive: true });
    await fs.mkdir(agent.workspaceFolder, { recursive: true });
    await seedAgentWorkspace({
        agentName: agent.name,
        bio: agent.bio ?? null,
        workspaceDir: agent.workspaceFolder,
    });
    registerAgentWorkspace(getDb(), {
        agentId: agent.id,
        agentName: agent.name,
        workspaceDir: agent.workspaceFolder,
    });
}

// Evidence lands as a durable system message in the agent's built-in DM —
// the agent's home surface — since the reset is agent-scoped, not
// chat-scoped. (Quiet system receipt; per-turn response rows retired, I1.)
function recordSessionResetNotice(input: { agentId: string; sessionId: string; text: string }) {
    const participantId = createAgentParticipantId(input.agentId);
    const dm = listChatsForAgentParticipant(participantId).find((chat) => chat.kind === 'dm');
    if (!dm) {
        return;
    }
    createMessage(dm.id, {
        author_id: 'sys_session_reset',
        content: input.text,
        id: createMessageId(),
        metadata: {
            runtime: {
                agentId: input.agentId,
                notice: 'new_session',
                sessionId: input.sessionId,
                source: 'session-reset',
            },
        },
        role: 'system',
    });
}
