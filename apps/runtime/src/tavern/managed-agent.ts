import type { AgentRuntimeAgent } from '@tavern/api';
import { defaultAgentDisplayName, defaultAgentEngineAgentId } from '../agent-engine/constants.ts';
import { tavernAgentSkillId, visualsSkillId } from '../agent-engine/skill-library.ts';
import { AGENT_WORKSPACE } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { getStoredAgent, upsertStoredAgent } from './agents-store.ts';

// Seeded skills every agent starts with; the upgrade below appends newly
// seeded ids to agents stored before those skills existed.
const defaultSeededSkillIds = [tavernAgentSkillId, visualsSkillId];

export function primaryManagedAgent(): AgentRuntimeAgent {
    return {
        enabledSkillIds: [...defaultSeededSkillIds],
        id: defaultAgentEngineAgentId,
        isAdmin: true,
        name: defaultAgentDisplayName,
        primaryColor: null,
        workspaceFolder: AGENT_WORKSPACE,
    };
}

export function ensurePrimaryManagedAgent(db?: Database) {
    const targetDb = db ?? getDb();
    const existing = getStoredAgent(defaultAgentEngineAgentId, targetDb);
    if (existing) {
        // The managed agent always carries the Tavern-seeded skills, even when
        // it was stored before a new seeded skill existed. Agents stored under
        // the retired "Tavern" default pick up the current default name; a
        // user-chosen name stays put.
        const missingSkillIds = defaultSeededSkillIds.filter(
            (skillId) => !existing.enabledSkillIds.includes(skillId)
        );
        const needsRename = existing.name === 'Tavern';
        const upgraded =
            missingSkillIds.length > 0 || needsRename
                ? upsertStoredAgent({
                      agent: {
                          ...existing,
                          enabledSkillIds: [...existing.enabledSkillIds, ...missingSkillIds],
                          name: needsRename ? defaultAgentDisplayName : existing.name,
                      },
                      db: targetDb,
                  })
                : existing;
        registerAgentWorkspace(targetDb, {
            agentId: upgraded.id,
            agentName: upgraded.name,
            workspaceDir: upgraded.workspaceFolder,
        });
        return upgraded;
    }

    const agent = upsertStoredAgent({ agent: primaryManagedAgent(), db: targetDb });
    registerAgentWorkspace(targetDb, {
        agentId: agent.id,
        agentName: agent.name,
        workspaceDir: agent.workspaceFolder,
    });

    return agent;
}
