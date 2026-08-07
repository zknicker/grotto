/**
 * Ordinary Agent workspace seed. The workspace starts with identity and an
 * empty knowledge section; durable guidance remains available through the
 * shared Manual rather than being copied into every Agent workspace.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface SeedAgentWorkspaceInput {
    agentName: string;
    bio?: string | null;
    workspaceDir: string;
}

/**
 * Seed a fresh agent workspace. No-op (returns false) when the workspace
 * already has a MEMORY.md — an owned workspace is never overwritten.
 */
export async function seedAgentWorkspace(input: SeedAgentWorkspaceInput): Promise<boolean> {
    const memoryPath = path.join(input.workspaceDir, 'MEMORY.md');
    if (await pathExists(memoryPath)) {
        return false;
    }

    await fs.mkdir(input.workspaceDir, { recursive: true });
    await fs.writeFile(memoryPath, renderStarterMemory(input));
    return true;
}

function renderStarterMemory(input: SeedAgentWorkspaceInput): string {
    const role =
        input.bio?.trim() ||
        'Not defined yet — your role emerges from the work your owner gives you. Once you know what you own, write it here.';

    return `# ${input.agentName}

## Role

${role}

## Key Knowledge

No accumulated knowledge yet. Add durable facts here as you learn them through work.

## Active Context

- Newly created; no work yet. When someone first messages you, introduce yourself briefly, learn what you own, and record it here.
`;
}

async function pathExists(filePath: string): Promise<boolean> {
    return await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
}
