/// <reference path="./visuals-skill/markdown.d.ts" />

import fs from 'node:fs/promises';
import path from 'node:path';
import designSystemMd from './visuals-skill/design-system.md' with { type: 'text' };
import iconsMd from './visuals-skill/icons.md' with { type: 'text' };
import { visualsSkillIconFiles, visualsSkillIconManifest } from './visuals-skill/icons.ts';
import visualsSkillMd from './visuals-skill/SKILL.md' with { type: 'text' };

export const tavernAgentSkillId = 'tavern-agent';
export const visualsSkillId = 'visuals';

export const defaultTavernAgentSkill = `# Grotto Agent

Use Grotto chat context, memory, files, and local tools. Keep replies direct and action-oriented.
`;

export const defaultVisualsSkill: string = visualsSkillMd;

export const visualsSkillFiles: Record<string, string> = {
    'references/design-system.md': designSystemMd,
    'references/icons.md': iconsMd,
    'references/icons/manifest.json': `${JSON.stringify({ icons: visualsSkillIconManifest }, null, 2)}\n`,
    ...Object.fromEntries(
        Object.entries(visualsSkillIconFiles).map(([file, svg]) => [`assets/icons/${file}`, svg])
    ),
};

const factoryManagedSkillFiles: Record<string, Record<string, string>> = {
    [tavernAgentSkillId]: { 'SKILL.md': defaultTavernAgentSkill },
    [visualsSkillId]: { 'SKILL.md': defaultVisualsSkill, ...visualsSkillFiles },
};

/** Restores release-owned skill files while preserving every Agent-authored skill. */
export async function seedFactoryManagedSkills(skillsDir: string): Promise<void> {
    for (const [skillId, files] of Object.entries(factoryManagedSkillFiles)) {
        for (const [relativePath, content] of Object.entries(files)) {
            const destination = path.join(skillsDir, skillId, ...relativePath.split('/'));
            await fs.mkdir(path.dirname(destination), { recursive: true });
            await fs.writeFile(destination, content, { mode: 0o600 });
        }
    }
}
