import type { AgentRuntimeAgent, AgentRuntimeModelName } from '@tavern/api';
import { AGENT_WORKSPACE } from '../config.ts';
import type { Database } from '../db/sqlite.ts';
import type { AgentRuntimeContextFacts } from '../workspace/instructions.ts';
import {
    generateAgentInstructions,
    getAgentWorkspaceSource,
    registerAgentWorkspace,
} from '../workspace/instructions.ts';
import { defaultAgentDisplayName } from './constants.ts';
import { agentSkillsDir, seedManagedSkills } from './skill-library.ts';

export const agentEngineAgentId = 'main';

// PROMPT CONTRACT: this composition feeds every agent's system prompt. Text
// or section changes must pass agent-prompt-contract.test.ts and need
// explicit operator approval. See AGENTS.md ("Agent System Prompt Changes").
export async function prepareAgentEngineInstructions(
    db: Database,
    agent: AgentRuntimeAgent | string = agentEngineAgentId,
    options: {
        model?: AgentRuntimeModelName;
        runtimeContext?: AgentRuntimeContextFacts;
        seedSkills?: boolean;
        skillsDir?: string;
    } = {}
) {
    const agentId = typeof agent === 'string' ? agent : agent.id;
    const agentName = typeof agent === 'string' ? defaultAgentDisplayName : agent.name;
    const workspaceDir = typeof agent === 'string' ? AGENT_WORKSPACE : agent.workspaceFolder;
    const source =
        getAgentWorkspaceSource(db, agentId) ??
        registerAgentWorkspace(db, {
            agentId,
            agentName,
            workspaceDir,
        });
    const generated = await generateAgentInstructions(db, source.agentId, {
        agent: typeof agent === 'string' ? null : agent,
        model: options.model,
        runtimeContext: options.runtimeContext,
    });

    if (options.seedSkills !== false) {
        // Seeding targets the Agent's own library so managed skills self-heal
        // in the same isolated directory the harness reads at turn start.
        await seedManagedSkills({ skillsDir: options.skillsDir ?? agentSkillsDir(agentId) });
    }

    return {
        content: generated.content,
        source,
    };
}
