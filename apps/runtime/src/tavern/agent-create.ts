/**
 * The one runtime path that brings an agent into existence: store the record,
 * create the workspace, seed the starter kit (WS8/ADR 0018), and register the
 * workspace for instruction rendering. The server's create route, dev demo
 * seeding, and the e2e harness all create agents through here — there is no
 * separate bootstrap path and no hardcoded seeded ids.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentArchetypeId } from '@tavern/api';
import { tavernAgentSkillId, visualsSkillId } from '../agent-engine/skill-library.ts';
import { AGENT_HOME } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { seedAgentWorkspace } from '../workspace/starter-kit.ts';
import { upsertStoredAgent } from './agents-store.ts';

// Seeded skills every new agent starts with. The pre-flip `tasks` skill is
// deliberately absent: its content teaches the retired tasks_* tool surface.
export const defaultSeededSkillIds = [tavernAgentSkillId, visualsSkillId];

export interface CreateRuntimeAgentInput {
    archetype?: AgentArchetypeId | null;
    bio?: string | null;
    db?: Database;
    enabledSkillIds?: string[];
    /** Server-created agents arrive with their id; omitted ids are generated. */
    id?: string;
    isAdmin?: boolean;
    name: string;
    primaryColor?: string | null;
    webAccessEnabled?: boolean;
    workspaceFolder?: string;
}

export async function createRuntimeAgent(input: CreateRuntimeAgentInput) {
    const id = input.id ?? generateAgentId(input.name);
    const agent = upsertStoredAgent({
        agent: {
            bio: input.bio ?? null,
            enabledSkillIds: input.enabledSkillIds ?? [...defaultSeededSkillIds],
            id,
            isAdmin: input.isAdmin ?? false,
            name: input.name,
            primaryColor: input.primaryColor ?? null,
            webAccessEnabled: input.webAccessEnabled ?? false,
            workspaceFolder:
                input.workspaceFolder ?? path.join(AGENT_HOME, 'agents', id, 'workspace'),
        },
        db: input.db,
    });
    await fs.mkdir(agent.workspaceFolder, { recursive: true });
    await seedAgentWorkspace({
        agentName: agent.name,
        archetype: input.archetype ?? null,
        bio: agent.bio ?? null,
        workspaceDir: agent.workspaceFolder,
    });
    registerAgentWorkspace(input.db ?? getDb(), {
        agentId: agent.id,
        agentName: agent.name,
        workspaceDir: agent.workspaceFolder,
    });
    return agent;
}

/** Same id shape the server mints: agt_<name-slug>_<8 hex chars>. */
export function generateAgentId(name: string) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32);

    return `agt_${slug || 'agent'}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
}
