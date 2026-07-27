import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { namedParams } from '../db/sqlite.ts';
import {
    deleteSkillPackage,
    importHostSkill,
    readSkillSource,
    recordSkillSource,
} from '../skills/store.ts';
import { listRuntimeSkills, readAssignedSkillBundles } from './skill-library.ts';

// Per-Agent libraries are separate directories, so isolation, mutation, and
// offline metadata are all exercised with temporary homes and no shared state.
describe('Per-Agent skill library', () => {
    let alice: string;
    let bob: string;

    beforeEach(async () => {
        alice = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-agent-alice-'));
        bob = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-agent-bob-'));
        ensureRuntimeSchema(initTestDb());
        seedAgentRow('alice', alice);
        seedAgentRow('bob', bob);
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(alice, { force: true, recursive: true });
        await fs.rm(bob, { force: true, recursive: true });
    });

    it('injects only the caller Agent library into its harness', async () => {
        await writeSkill(alice, 'shared', '# Alice shared\n\nAlice edition.');
        await writeSkill(bob, 'shared', '# Bob shared\n\nBob edition.');
        await writeSkill(bob, 'bob-only', '# Bob only\n\nBob secret.');

        const aliceBundles = await readAssignedSkillBundles(
            { enabledSkillIds: ['shared', 'bob-only'] },
            { skillsDir: alice }
        );

        expect(aliceBundles.map((bundle) => bundle.id)).toEqual(['shared']);
        expect(aliceBundles[0]?.content).toContain('Alice edition.');
        expect(aliceBundles[0]?.content).not.toContain('Bob');
    });

    it('reports compact metadata that stays readable offline', async () => {
        await writeSkill(alice, 'research', '---\nsummary: Research well\n---\n\n# Research');

        const [summary] = (await listRuntimeSkills({ skillsDir: alice })).filter(
            (skill) => skill.id === 'research'
        );

        expect(summary).toMatchObject({
            description: 'Research well',
            id: 'research',
            name: 'research',
        });
        expect(summary?.updatedAt).toEqual(expect.any(String));
    });

    it('deletes only the caller Agent copy and its source record', async () => {
        await writeSkill(alice, 'notes', '# Notes\n\nAlice notes.');
        await writeSkill(bob, 'notes', '# Notes\n\nBob notes.');
        recordSkillSource({ createdByAgentId: 'alice', skillId: 'notes', source: 'agent' });

        await deleteSkillPackage({ agentId: 'alice', skillId: 'notes', skillsDir: alice });

        await expect(fs.readdir(alice)).resolves.not.toContain('notes');
        await expect(fs.readFile(path.join(bob, 'notes', 'SKILL.md'), 'utf8')).resolves.toContain(
            'Bob notes.'
        );
        expect(readSkillSource('notes')).toBeNull();
    });

    it('imports a host bundle as an independent mutable copy', async () => {
        const hostSources = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-host-'));
        await writeSkill(hostSources, 'release-checks', '# Release\n\nHost edition.');

        const imported = await importHostSkill({
            agentId: 'alice',
            skillId: 'release-checks',
            skillsDir: alice,
            sourceDir: hostSources,
        });

        expect(imported).toMatchObject({ id: 'release-checks', name: 'release-checks' });
        expect(readSkillSource('release-checks')?.source).toBe('external');

        // Editing the imported copy never touches the host source.
        await fs.writeFile(
            path.join(alice, 'release-checks', 'SKILL.md'),
            '# Release\n\nAgent edition.'
        );
        await expect(
            fs.readFile(path.join(hostSources, 'release-checks', 'SKILL.md'), 'utf8')
        ).resolves.toContain('Host edition.');

        await fs.rm(hostSources, { force: true, recursive: true });
    });

    async function writeSkill(dir: string, name: string, content: string) {
        await fs.mkdir(path.join(dir, name), { recursive: true });
        await fs.writeFile(path.join(dir, name, 'SKILL.md'), content, 'utf8');
    }

    function seedAgentRow(agentId: string, workspaceFolder: string) {
        const now = new Date().toISOString();
        getDb()
            .prepare(
                `INSERT INTO agents (id, name, workspace_folder, raw_json, last_synced_at, created_at, updated_at)
                 VALUES ($id, $id, $workspaceFolder, '{}', $now, $now, $now)`
            )
            .run(namedParams({ id: agentId, now, workspaceFolder }));
    }
});
