import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { listRuntimeSkills } from '../agent-engine/skill-library.ts';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { applySkillLifecycleTransitions, archiveAgentSkill } from './lifecycle.ts';
import { createAgentSkill, recordSkillSource } from './store.ts';
import { recordSkillUsage } from './telemetry.ts';

describe('skill lifecycle', () => {
    let skillsDir: string;

    beforeEach(async () => {
        skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-lifecycle-skills-'));
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: true,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder: os.tmpdir(),
            },
            syncedAt: '2026-07-01T00:00:00.000Z',
        });
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(skillsDir, { force: true, recursive: true });
    });

    test('marks an unused 31 day old agent skill stale', async () => {
        await createSkill('Runtime Notes', '2026-06-01T00:00:00.000Z');

        await applySkillLifecycleTransitions({
            now: new Date('2026-07-02T00:00:00.000Z'),
            skillsDir,
        });

        expect(readSource('runtime-notes')).toMatchObject({ state: 'stale' });
        await expect(
            fs.stat(path.join(skillsDir, 'runtime-notes', 'SKILL.md'))
        ).resolves.toBeTruthy();
    });

    test('archives a 91 day old unused agent skill as a whole package', async () => {
        await createSkill('Old Narrow Skill', '2026-04-01T00:00:00.000Z');
        await fs.mkdir(path.join(skillsDir, 'old-narrow-skill', 'references'), {
            recursive: true,
        });
        await fs.writeFile(
            path.join(skillsDir, 'old-narrow-skill', 'references', 'detail.md'),
            'important detail',
            'utf8'
        );

        await applySkillLifecycleTransitions({
            now: new Date('2026-07-01T00:00:01.000Z'),
            skillsDir,
        });

        expect(readSource('old-narrow-skill')).toMatchObject({
            archived_at: '2026-07-01T00:00:01.000Z',
            state: 'archived',
        });
        await expect(
            fs.readFile(
                path.join(skillsDir, '.archive', 'old-narrow-skill', 'references', 'detail.md'),
                'utf8'
            )
        ).resolves.toBe('important detail');
        await expect(fs.stat(path.join(skillsDir, 'old-narrow-skill'))).rejects.toThrow();
        expect(readAssignment('old-narrow-skill')).toMatchObject({ enabled: 0 });
        await expect(listRuntimeSkills({ skillsDir })).resolves.not.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'old-narrow-skill' })])
        );
    });

    test('recent use keeps or returns an agent skill active', async () => {
        await createSkill('Recently Used', '2026-04-01T00:00:00.000Z');
        setSkillState('recently-used', 'stale');
        recordSkillUsage({
            agentId: 'agt_primary',
            kind: 'viewed',
            occurredAt: '2026-07-01T23:00:00.000Z',
            skillId: 'recently-used',
        });

        await applySkillLifecycleTransitions({
            now: new Date('2026-07-02T00:00:00.000Z'),
            skillsDir,
        });

        expect(readSource('recently-used')).toMatchObject({ state: 'active' });
        await expect(
            fs.stat(path.join(skillsDir, 'recently-used', 'SKILL.md'))
        ).resolves.toBeTruthy();
    });

    test('leaves seeded hub and external skills untouched at any age', async () => {
        for (const source of ['seeded', 'hub', 'external'] as const) {
            await writeSkillDir(source);
            recordSkillSource({ skillId: source, source });
            setCreatedAt(source, '2026-01-01T00:00:00.000Z');
        }

        await applySkillLifecycleTransitions({
            now: new Date('2026-07-02T00:00:00.000Z'),
            skillsDir,
        });

        expect(readSource('seeded')).toMatchObject({ state: 'active' });
        expect(readSource('hub')).toMatchObject({ state: 'active' });
        expect(readSource('external')).toMatchObject({ state: 'active' });
    });

    test('archiveAgentSkill rejects read-only skills and archives agent skills', async () => {
        await createSkill('Archive Me', '2026-07-01T00:00:00.000Z');
        await writeSkillDir('seeded');
        recordSkillSource({ skillId: 'seeded', source: 'seeded' });

        await expect(archiveAgentSkill({ skillId: 'seeded', skillsDir })).rejects.toThrow(
            'cannot be archived'
        );
        await archiveAgentSkill({ skillId: 'archive-me', skillsDir });
        expect(readSource('archive-me')).toMatchObject({ state: 'archived' });
        await expect(fs.stat(path.join(skillsDir, '.archive', 'archive-me'))).resolves.toBeTruthy();
    });

    async function createSkill(name: string, createdAt: string) {
        const created = await createAgentSkill({
            agentId: 'agt_primary',
            content: `# ${name}\n\nUse this.`,
            description: name,
            name,
            skillsDir,
        });
        setCreatedAt(created.id, createdAt);
        return created;
    }

    async function writeSkillDir(skillId: string) {
        await fs.mkdir(path.join(skillsDir, skillId), { recursive: true });
        await fs.writeFile(path.join(skillsDir, skillId, 'SKILL.md'), `# ${skillId}`, 'utf8');
    }

    function readSource(skillId: string) {
        return getDb()
            .prepare('SELECT * FROM skill_sources WHERE skill_id = $skillId')
            .get({ $skillId: skillId }) as {
            archived_at: string | null;
            state: string;
        };
    }

    function readAssignment(skillId: string) {
        return getDb()
            .prepare('SELECT * FROM agent_skill_assignments WHERE skill_id = $skillId')
            .get({ $skillId: skillId }) as { enabled: number };
    }

    function setCreatedAt(skillId: string, createdAt: string) {
        getDb()
            .prepare(
                `UPDATE skill_sources
                 SET created_at = $createdAt,
                     updated_at = $createdAt
                 WHERE skill_id = $skillId`
            )
            .run({ $createdAt: createdAt, $skillId: skillId });
    }

    function setSkillState(skillId: string, state: string) {
        getDb()
            .prepare('UPDATE skill_sources SET state = $state WHERE skill_id = $skillId')
            .run({ $skillId: skillId, $state: state });
    }
});
