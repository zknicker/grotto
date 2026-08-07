import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { createAgentSkill, readSkillSource, sha256 } from '../skills/store.ts';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events.ts';
import { getSkillHubAvailable, installSkillHubSkill } from './skill-hub-library.ts';
import {
    getRuntimeSkill,
    listRuntimeSkills,
    readAssignedSkillBundles,
    resetRuntimeSkillToDefault,
    resetSeededSkill,
    seedManagedSkills,
    visualsSkillId,
} from './skill-library.ts';

describe('Runtime skill library', () => {
    let skillsDir: string;

    beforeEach(async () => {
        skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skills-'));
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(skillsDir, { force: true, recursive: true });
    });

    it('lists installed skill packages and exposes detail content', async () => {
        await writeSkill(
            'research',
            '---\nsummary: Research well\n---\n\n# Research\n\nUse sources.'
        );
        await fs.writeFile(path.join(skillsDir, 'research', 'README.md'), 'extra', 'utf8');

        const skills = await listRuntimeSkills({ skillsDir });
        const skill = await getRuntimeSkill('research', { skillsDir });
        const visualsSkill = await getRuntimeSkill(visualsSkillId, { skillsDir });

        expect(skills).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: visualsSkillId, source: 'builtin' }),
                expect.objectContaining({
                    description: 'Research well',
                    id: 'research',
                    source: 'installed',
                }),
            ])
        );
        expect(skill).toMatchObject({
            contentMarkdown: expect.stringContaining('Use sources.'),
            files: expect.arrayContaining([
                { path: 'README.md', sizeBytes: 5 },
                expect.objectContaining({ path: 'SKILL.md' }),
            ]),
            id: 'research',
        });
        expect(visualsSkill).toMatchObject({
            contentMarkdown: expect.stringContaining('```visual'),
            id: visualsSkillId,
        });
    });

    it('installs built-in hub skills into the inventory', async () => {
        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {},
        });

        await expect(
            installSkillHubSkill('builtin:tavern-workflow', { skillsDir })
        ).resolves.toMatchObject({
            ok: true,
        });
        expect(readSkillSource('tavern-workflow')?.installedHash).toBe(
            sha256(await fs.readFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), 'utf8'))
        );

        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': {
                    edited: false,
                    name: 'tavern-workflow',
                    scanVerdict: 'allow',
                    trustLevel: 'builtin',
                    updateAvailable: false,
                },
            },
        });
        await expect(listRuntimeSkills({ skillsDir })).resolves.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'tavern-workflow' })])
        );
    });

    it('reports hub edited and update flags from installed hashes', async () => {
        await installSkillHubSkill('builtin:tavern-workflow', { skillsDir });

        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': { edited: false, updateAvailable: false },
            },
        });

        await fs.appendFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), '\nLocal note.');
        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': { edited: true, updateAvailable: false },
            },
        });

        const oldBundle = '# Old Tavern Workflow\n';
        const oldBundleHash = sha256(oldBundle);
        getDb()
            .prepare(
                `UPDATE skill_sources
                 SET installed_hash = $hash
                 WHERE skill_id = 'tavern-workflow'`
            )
            .run({ $hash: oldBundleHash });
        await fs.writeFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), oldBundle, 'utf8');
        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': { edited: false, updateAvailable: true },
            },
        });

        getDb()
            .prepare(
                `UPDATE skill_sources
                 SET installed_hash = NULL
                 WHERE skill_id = 'tavern-workflow'`
            )
            .run();
        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': { edited: false, updateAvailable: false },
            },
        });
    });

    it('returns install conflicts for edited hub skills unless force is set', async () => {
        await installSkillHubSkill('builtin:tavern-workflow', { skillsDir });
        await fs.appendFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), '\nLocal note.');

        await expect(
            installSkillHubSkill('builtin:tavern-workflow', { skillsDir })
        ).resolves.toMatchObject({
            conflict: true,
            exitCode: null,
            ok: false,
        });
        await expect(
            fs.readFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), 'utf8')
        ).resolves.toContain('Local note.');

        await expect(
            installSkillHubSkill('builtin:tavern-workflow', {
                force: true,
                skillsDir,
            })
        ).resolves.toMatchObject({ ok: true });
        await expect(
            fs.readFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), 'utf8')
        ).resolves.not.toContain('Local note.');
    });

    it('resets the seeded visuals skill to the release default', async () => {
        await seedManagedSkills({ skillsDir });
        const defaultContent = await fs.readFile(
            path.join(skillsDir, visualsSkillId, 'SKILL.md'),
            'utf8'
        );
        await fs.writeFile(
            path.join(skillsDir, visualsSkillId, 'SKILL.md'),
            '# Visuals\n\nLocal edit.'
        );

        await expect(resetSeededSkill(visualsSkillId, { skillsDir })).resolves.toEqual({
            hash: sha256(defaultContent),
            skillId: visualsSkillId,
        });
        await expect(
            fs.readFile(path.join(skillsDir, visualsSkillId, 'SKILL.md'), 'utf8')
        ).resolves.toBe(defaultContent);
        expect(readSkillSource(visualsSkillId)?.source).toBe('seeded');
    });

    it('seeds only visuals and leaves an existing Tavern skill untouched', async () => {
        await writeSkill('tavern-agent', '# Stale skill\n');
        await seedManagedSkills({ skillsDir });

        await expect(
            fs.readFile(path.join(skillsDir, 'tavern-agent', 'SKILL.md'), 'utf8')
        ).resolves.toBe('# Stale skill\n');
        await expect(
            fs.readFile(path.join(skillsDir, visualsSkillId, 'SKILL.md'), 'utf8')
        ).resolves.toContain('```visual');
        await expect(listRuntimeSkills({ skillsDir })).resolves.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    bundled: false,
                    id: 'tavern-agent',
                    source: 'installed',
                }),
            ])
        );
    });

    it('seeds the visuals skill with references and icon assets', async () => {
        await seedManagedSkills({ skillsDir });

        expect(readSkillSource(visualsSkillId)?.source).toBe('seeded');
        const designSystem = await fs.readFile(
            path.join(skillsDir, visualsSkillId, 'references', 'design-system.md'),
            'utf8'
        );
        expect(designSystem).toContain('chart.js@4.5.1');
        expect(designSystem).toContain('Text never wears the series color');
        const manifest = JSON.parse(
            await fs.readFile(
                path.join(skillsDir, visualsSkillId, 'references', 'icons', 'manifest.json'),
                'utf8'
            )
        ) as { icons: { file: string }[] };
        expect(manifest.icons.length).toBeGreaterThan(50);
        await expect(
            fs.readFile(
                path.join(skillsDir, visualsSkillId, 'assets', 'icons', manifest.icons[0].file),
                'utf8'
            )
        ).resolves.toContain('currentColor');

        // The gate SKILL.md carries the visual and artifact fence contracts.
        const bundles = await readAssignedSkillBundles(
            { enabledSkillIds: [visualsSkillId] },
            { skillsDir }
        );
        expect(bundles).toHaveLength(1);
        expect(bundles[0]?.content).toContain('```visual Weekly sales');
        expect(bundles[0]?.content).toContain('```artifact');
        expect(bundles[0]?.content).toContain('design-system.md');
        expect(bundles[0]?.description.length).toBeGreaterThan(0);
        expect(bundles[0]?.files.map((file) => file.path)).toEqual(
            expect.arrayContaining(['references/design-system.md', 'references/icons.md'])
        );
    });

    it('restores tampered seeded reference files on reseed', async () => {
        await seedManagedSkills({ skillsDir });
        const referencePath = path.join(
            skillsDir,
            visualsSkillId,
            'references',
            'design-system.md'
        );
        await fs.writeFile(referencePath, '# Tampered\n', 'utf8');

        await seedManagedSkills({ skillsDir });

        await expect(fs.readFile(referencePath, 'utf8')).resolves.toContain('chart.js@4.5.1');
    });

    it('restores tampered visuals skill content and publishes its update', async () => {
        await seedManagedSkills({ skillsDir });
        const defaultContent = await fs.readFile(
            path.join(skillsDir, visualsSkillId, 'SKILL.md'),
            'utf8'
        );
        await fs.writeFile(path.join(skillsDir, visualsSkillId, 'SKILL.md'), '# Tampered\n');
        const events: unknown[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => events.push(event));

        try {
            await seedManagedSkills({ skillsDir });
        } finally {
            unsubscribe();
        }

        await expect(
            fs.readFile(path.join(skillsDir, visualsSkillId, 'SKILL.md'), 'utf8')
        ).resolves.toBe(defaultContent);
        expect(readSkillSource(visualsSkillId)).toMatchObject({
            installedHash: sha256(defaultContent),
            source: 'seeded',
        });
        expect(events).toContainEqual(
            expect.objectContaining({ skillId: visualsSkillId, type: 'skill.updated' })
        );
    });

    it('reports visuals skill summary edit and managed flags', async () => {
        await seedManagedSkills({ skillsDir });

        await expect(readSkillSummary(visualsSkillId)).resolves.toMatchObject({
            edited: false,
            managedSource: 'seeded',
            updateAvailable: false,
        });
        const defaultContent = await fs.readFile(
            path.join(skillsDir, visualsSkillId, 'SKILL.md'),
            'utf8'
        );
        expect(readSkillSource(visualsSkillId)?.installedHash).toBe(sha256(defaultContent));

        await fs.appendFile(path.join(skillsDir, visualsSkillId, 'SKILL.md'), '\nLocal edit.');

        await expect(readSkillSummary(visualsSkillId)).resolves.toMatchObject({
            edited: true,
            managedSource: 'seeded',
            updateAvailable: false,
        });
    });

    it('reports hub skill summary update and edit flags', async () => {
        await installSkillHubSkill('builtin:tavern-workflow', { skillsDir });

        await expect(readSkillSummary('tavern-workflow')).resolves.toMatchObject({
            edited: false,
            managedSource: 'hub',
            updateAvailable: false,
        });

        const oldBundle = '# Old Tavern Workflow\n';
        getDb()
            .prepare(
                `UPDATE skill_sources
                 SET installed_hash = $hash
                 WHERE skill_id = 'tavern-workflow'`
            )
            .run({ $hash: sha256(oldBundle) });
        await fs.writeFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), oldBundle, 'utf8');

        await expect(readSkillSummary('tavern-workflow')).resolves.toMatchObject({
            edited: false,
            managedSource: 'hub',
            updateAvailable: true,
        });

        await fs.appendFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), '\nLocal edit.');

        await expect(readSkillSummary('tavern-workflow')).resolves.toMatchObject({
            edited: true,
            managedSource: 'hub',
            updateAvailable: true,
        });
    });

    it('rejects reset for non-seeded skills', async () => {
        await expect(resetRuntimeSkillToDefault('tavern-workflow', { skillsDir })).rejects.toThrow(
            'Only seeded skills have Grotto defaults.'
        );
    });

    it('leaves agent-created skill summaries unmanaged', async () => {
        await createAgentSkill({
            agentId: null,
            content: '# Research\n\nCheck primary sources.',
            description: 'Research',
            name: 'Research',
            skillsDir,
        });

        await expect(readSkillSummary('research')).resolves.toMatchObject({
            edited: false,
            managedSource: null,
            updateAvailable: false,
        });
    });

    it('loads assigned skill content for agent execution', async () => {
        await writeSkill('research', '# Research\n\nCheck primary sources.');
        await fs.mkdir(path.join(skillsDir, 'research', 'references'), {
            recursive: true,
        });
        await fs.writeFile(
            path.join(skillsDir, 'research', 'references', 'checklist.md'),
            'Use primary sources.',
            'utf8'
        );

        await expect(
            readAssignedSkillBundles(
                {
                    enabledSkillIds: ['missing', 'research', 'research'],
                },
                { skillsDir }
            )
        ).resolves.toEqual([
            {
                content: '# Research\n\nCheck primary sources.',
                description: 'Check primary sources.',
                files: [
                    {
                        content: 'Use primary sources.',
                        path: 'references/checklist.md',
                    },
                ],
                id: 'research',
                name: 'research',
                path: path.join(skillsDir, 'research', 'SKILL.md'),
            },
        ]);
    });

    it('ignores dot directories such as the skill archive', async () => {
        await writeSkill('active-skill', '# Active Skill\n\nUse this.');
        await fs.mkdir(path.join(skillsDir, '.archive', 'old-skill'), {
            recursive: true,
        });
        await fs.writeFile(
            path.join(skillsDir, '.archive', 'old-skill', 'SKILL.md'),
            '# Old Skill\n\nArchived.',
            'utf8'
        );

        await expect(listRuntimeSkills({ skillsDir })).resolves.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'active-skill' })])
        );
        await expect(listRuntimeSkills({ skillsDir })).resolves.not.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'old-skill' })])
        );
    });

    async function writeSkill(name: string, content: string) {
        const skillDir = path.join(skillsDir, name);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf8');
    }

    async function readSkillSummary(skillId: string) {
        const summary = (await listRuntimeSkills({ skillsDir })).find(
            (skill) => skill.id === skillId
        );
        if (!summary) {
            throw new Error(`Missing skill summary: ${skillId}`);
        }
        return summary;
    }
});
