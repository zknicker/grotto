/**
 * Workspace starter kit (WS8, D7): every agent is born with a starter
 * MEMORY.md and seed-practice notes adapted from Raft's seeded recipe tier.
 * The seed is a starting point the agent grows — identity accumulates in
 * memory (ruling W2) — so seeding never touches a workspace that already has
 * a MEMORY.md.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentArchetypeId } from '@tavern/api';
import { archetypeSeedNotes } from './archetype-notes.ts';
import { practiceNotes, type StarterNote } from './practice-notes.ts';

export interface SeedAgentWorkspaceInput {
    agentName: string;
    archetype?: AgentArchetypeId | null;
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

    const archetypeNotes = input.archetype ? archetypeSeedNotes[input.archetype] : [];
    const notesDir = path.join(input.workspaceDir, 'notes');
    const practicesDir = path.join(notesDir, 'practices');
    await fs.mkdir(practicesDir, { recursive: true });
    await Promise.all([
        ...archetypeNotes.map((note) =>
            fs.writeFile(path.join(notesDir, note.fileName), note.content)
        ),
        ...practiceNotes.map((note) =>
            fs.writeFile(path.join(practicesDir, note.fileName), note.content)
        ),
    ]);
    await fs.writeFile(
        memoryPath,
        renderStarterMemory({
            agentName: input.agentName,
            archetypeNotes,
            bio: input.bio ?? null,
        })
    );
    return true;
}

function renderStarterMemory(input: {
    agentName: string;
    archetypeNotes: StarterNote[];
    bio: string | null;
}): string {
    const role =
        input.bio?.trim() ||
        'Not defined yet — your role emerges from the work your owner gives you. Once you know what you own, write it here.';
    const archetypeIndex = input.archetypeNotes
        .map((note) => `- notes/${note.fileName} — ${note.hook}`)
        .join('\n');
    const practicesIndex = practiceNotes
        .map((note) => `  - notes/practices/${note.fileName} — ${note.hook}`)
        .join('\n');

    return `# ${input.agentName}

## Role

${role}

This may evolve — update it as your lane sharpens.

## Key Knowledge

${archetypeIndex ? `${archetypeIndex}\n` : ''}- Seeded practices (notes/practices/) — the highest-frequency judgment calls on a human-agent team. Skim once now; pull the full note when you hit the situation:
${practicesIndex}

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
