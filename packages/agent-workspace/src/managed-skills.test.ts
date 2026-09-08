import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    defaultVisualsSkill,
    seedFactoryManagedSkills,
    visualsSkillFiles,
} from './managed-skills.ts';

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

/**
 * The design system teaches the app's own type scale and the published token
 * names from `agent-html/tokens.ts`. Both drift silently — an agent keeps
 * emitting 16px text or a retired token name long after the app moved.
 */
test('visuals design system teaches the app type scale and published token names', () => {
    const designSystem = visualsSkillFiles['references/design-system.md'] ?? '';

    expect(designSystem).toContain('The base body size is **14px**');
    expect(designSystem).toContain('Body text: 14px, line-height 1.5.');
    expect(designSystem).toContain('Title / section labels: 15–16px');
    expect(designSystem).toContain('Secondary text, dense table cells, and code: 12–13px.');
    expect(designSystem).toContain(
        'Metadata and compact labels: 11–12px. No font-size below 11px.'
    );
    expect(designSystem).not.toContain('16px, line-height 1.5');

    for (const token of [
        '--app-ui-font-size',
        '--app-code-font-size',
        '--surface-secondary',
        '--surface-tertiary',
        '--ease-out',
        '--ease-in',
        '--ease-standard',
    ]) {
        expect(designSystem).toContain(token);
    }

    for (const retired of ['--ease-in-out-quad', '--surface-2', '--surface-3', '--surface-4']) {
        expect(designSystem).not.toContain(retired);
    }
});

test('visuals skill states the 14px visual frame text size', () => {
    expect(defaultVisualsSkill).toContain('14px text');
    expect(defaultVisualsSkill).not.toContain('Tavern');
});
