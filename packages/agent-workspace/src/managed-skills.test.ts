import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultVisualsSkill, seedFactoryManagedSkills } from './managed-skills.ts';

let skillsDir = '';

beforeEach(async () => {
    skillsDir = await mkdtemp(join(tmpdir(), 'grotto-managed-skills-'));
});

afterEach(async () => {
    await rm(skillsDir, { force: true, recursive: true });
});

test('restores visuals without removing authored or stale factory skills', async () => {
    await mkdir(join(skillsDir, 'authored'), { recursive: true });
    await writeFile(join(skillsDir, 'authored', 'SKILL.md'), '# Authored\n');
    await mkdir(join(skillsDir, 'grotto-agent'), { recursive: true });
    await writeFile(join(skillsDir, 'grotto-agent', 'SKILL.md'), '# stale\n');

    await seedFactoryManagedSkills(skillsDir);

    await expect(readFile(join(skillsDir, 'authored', 'SKILL.md'), 'utf8')).resolves.toBe(
        '# Authored\n'
    );
    await expect(readFile(join(skillsDir, 'grotto-agent', 'SKILL.md'), 'utf8')).resolves.toBe(
        '# stale\n'
    );
    await expect(readFile(join(skillsDir, 'visuals', 'SKILL.md'), 'utf8')).resolves.toBe(
        defaultVisualsSkill
    );
    await expect(
        readFile(join(skillsDir, 'visuals', 'references', 'design-system.md'), 'utf8')
    ).resolves.toContain('# Grotto visuals — design system');
});
