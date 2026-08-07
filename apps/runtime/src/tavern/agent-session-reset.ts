import fs from 'node:fs/promises';
import { seedAgentWorkspace } from '@tavern/agent-workspace';
import { closeMcpClientsForAgent } from '../agent-engine/mcp-clients.ts';
import { agentSkillsDir, seedManagedSkills } from '../agent-engine/skill-library.ts';
import { getDb } from '../db/connection.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { startNewAgentSession } from './agent-session-store.ts';
import { rotateAgentToken } from './agent-tokens.ts';
import { getStoredAgent } from './agents-store.ts';
import { recordSessionRotationReceipt } from './session-receipts.ts';

// Manual reset contract (specs/sessions.md): human-initiated, agent-scoped.
// "Session reset" starts a fresh global session; workspace, MEMORY.md, and
// skills persist. "Full reset" also recreates the workspace and the agent's
// canonical skill library from the ordinary factory state: minimal MEMORY.md
// plus visuals. Both rotate the session generation and agent token and land a
// receipt. Restart is a separate lifecycle action that does none of this
// (agent-turn-runner.ts): it resumes the current session unchanged.

export type AgentResetKind = 'full' | 'session';

export async function resetAgentSession(input: {
    agentId: string;
    kind?: AgentResetKind;
    noticeText?: string;
}) {
    const kind = input.kind ?? 'session';
    if (kind === 'full') {
        await wipeAgentWorkspace(input.agentId);
        await resetAgentSkillLibrary(input.agentId);
    }
    await closeMcpClientsForAgent(input.agentId);
    const session = startNewAgentSession({ agentId: input.agentId });
    rotateAgentToken(input.agentId);
    recordSessionRotationReceipt({
        agentId: input.agentId,
        reason: kind,
        sessionId: session.id,
        text:
            input.noticeText ??
            (kind === 'full'
                ? 'Started completely fresh: new session, a minimal workspace, and factory-managed skills. Earlier files and MEMORY.md are gone.'
                : 'Started a fresh session. New messages start with fresh context; your workspace and MEMORY.md are intact.'),
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

// Full reset recreates the agent's canonical skill library too (ADR 0011):
// authored or edited skills are discarded back to the visuals managed set.
// Server identity, model configuration, and MCP grants are untouched.
async function resetAgentSkillLibrary(agentId: string) {
    const skillsDir = agentSkillsDir(agentId);
    await fs.rm(skillsDir, { force: true, recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });
    await seedManagedSkills({ skillsDir });
}
