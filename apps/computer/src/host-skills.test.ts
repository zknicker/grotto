import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importHostSkill, listAgentSkillReports, listImportableSkills } from './host-skills.ts';

let dataRoot: string;
let sourceRoot: string;

beforeEach(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), 'grotto-host-skills-'));
    sourceRoot = await mkdtemp(join(tmpdir(), 'grotto-host-sources-'));
});

afterEach(async () => {
    await rm(dataRoot, { force: true, recursive: true });
    await rm(sourceRoot, { force: true, recursive: true });
});

test('reports metadata only and imports an independent Agent copy', async () => {
    const source = join(sourceRoot, 'release-checks');
    await mkdir(join(source, 'scripts'), { recursive: true });
    await writeFile(
        join(source, 'SKILL.md'),
        '---\ndescription: Verify a release\n---\n\n# Release checks\n'
    );
    await writeFile(join(source, 'scripts', 'check.sh'), '#!/bin/zsh\nexit 0\n', {
        mode: 0o700,
    });

    const [available] = await listImportableSkills([sourceRoot]);
    expect(available).toMatchObject({
        description: 'Verify a release',
        name: 'release-checks',
    });
    expect(JSON.stringify(available)).not.toContain('exit 0');

    const imported = await importHostSkill({
        agentId: 'agt_hostskillsxxxxxx',
        dataRoot,
        roots: [sourceRoot],
        serverId: 'srv_hostskills',
        sourceId: available?.id ?? '',
    });
    expect(imported).toMatchObject({
        description: 'Verify a release',
        name: 'release-checks',
    });

    await writeFile(join(source, 'SKILL.md'), '# Changed source');
    expect(
        await readFile(
            join(
                dataRoot,
                'servers',
                'srv_hostskills',
                'agents',
                'agt_hostskillsxxxxxx',
                'skills',
                'release-checks',
                'SKILL.md'
            ),
            'utf8'
        )
    ).toContain('Verify a release');
    expect(await listAgentSkillReports(dataRoot, 'srv_hostskills')).toEqual([
        { agentId: 'agt_hostskillsxxxxxx', skills: [imported] },
    ]);
});

test('dedupes symlinked sources and never imports symlinks from a bundle', async () => {
    const source = join(sourceRoot, 'safe');
    const otherRoot = await mkdtemp(join(tmpdir(), 'grotto-host-sources-link-'));
    await mkdir(source);
    await writeFile(join(source, 'SKILL.md'), '# Safe');
    await symlink('/tmp', join(source, 'escape'));
    await symlink(source, join(otherRoot, 'safe'));

    expect(await listImportableSkills([sourceRoot, otherRoot])).toHaveLength(1);
    const [available] = await listImportableSkills([sourceRoot]);
    await importHostSkill({
        agentId: 'agt_hostskillsxxxxxx',
        dataRoot,
        roots: [sourceRoot],
        serverId: 'srv_hostskills',
        sourceId: available?.id ?? '',
    });
    await expect(
        readFile(
            join(
                dataRoot,
                'servers',
                'srv_hostskills',
                'agents',
                'agt_hostskillsxxxxxx',
                'skills',
                'safe',
                'escape'
            )
        )
    ).rejects.toThrow();
    await rm(otherRoot, { force: true, recursive: true });
});
