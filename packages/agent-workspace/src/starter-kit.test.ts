import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { archetypeSeedNotes } from './archetype-notes.ts';
import { practiceNotes } from './practice-notes.ts';
import { seedAgentWorkspace } from './starter-kit.ts';

describe('agent workspace starter kit', () => {
    let workspaceDir = '';

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-starter-kit-'));
    });

    afterEach(async () => {
        await fs.rm(workspaceDir, { force: true, recursive: true });
    });

    it('seeds MEMORY.md and every practice note into a fresh workspace', async () => {
        const seeded = await seedAgentWorkspace({
            agentName: 'scout',
            bio: 'Operator — ships scoped, verified changes end to end',
            workspaceDir,
        });

        expect(seeded).toBe(true);
        const memory = await fs.readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8');
        expect(memory).toMatch(/^# scout\n/u);
        expect(memory).toContain('Operator — ships scoped, verified changes end to end');
        for (const note of practiceNotes) {
            expect(memory).toContain(`notes/practices/${note.fileName} — ${note.hook}`);
            const content = await fs.readFile(
                path.join(workspaceDir, 'notes', 'practices', note.fileName),
                'utf8'
            );
            expect(content).toBe(note.content);
        }
    });

    it('falls back to an undefined-role line when the agent has no bio', async () => {
        await seedAgentWorkspace({ agentName: 'blank', workspaceDir });

        const memory = await fs.readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8');
        expect(memory).toContain('Not defined yet — your role emerges from the work');
    });

    it('never touches a workspace that already has a MEMORY.md', async () => {
        await fs.writeFile(path.join(workspaceDir, 'MEMORY.md'), '# mine\n');

        const seeded = await seedAgentWorkspace({ agentName: 'scout', workspaceDir });

        expect(seeded).toBe(false);
        await expect(fs.readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8')).resolves.toBe(
            '# mine\n'
        );
        await expect(fs.stat(path.join(workspaceDir, 'notes'))).rejects.toThrow();
    });

    it('seeds the archetype lane note and indexes it in MEMORY.md', async () => {
        await seedAgentWorkspace({ agentName: 'analyst', archetype: 'analyst', workspaceDir });

        const memory = await fs.readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8');
        expect(memory).toContain('notes/lane.md — ');
        const lane = await fs.readFile(path.join(workspaceDir, 'notes', 'lane.md'), 'utf8');
        expect(lane).toContain('# Your lane: data reads for decisions');
    });

    it('seeds the onboarding notes for the guide archetype', async () => {
        await seedAgentWorkspace({ agentName: 'guide', archetype: 'guide', workspaceDir });

        const memory = await fs.readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8');
        for (const note of archetypeSeedNotes.guide) {
            expect(memory).toContain(`notes/${note.fileName} — ${note.hook}`);
            await expect(
                fs.readFile(path.join(workspaceDir, 'notes', note.fileName), 'utf8')
            ).resolves.toBe(note.content);
        }
        expect(archetypeSeedNotes.guide.map((note) => note.fileName)).toEqual([
            'onboarding-playbook.md',
            'onboarding-objectives.md',
            'onboarding-faq.md',
        ]);
    });

    it('keeps seeded content free of Raft naming and with intact cross-links', () => {
        const allNotes = [...practiceNotes, ...Object.values(archetypeSeedNotes).flat()];
        const practiceFileNames = new Set(practiceNotes.map((note) => note.fileName));

        for (const note of allNotes) {
            // Product-language boundary: seeds are Grotto knowledge, not
            // provenance from another team's install.
            expect(note.content, note.fileName).not.toMatch(/\braft\b/iu);
            for (const match of note.content.matchAll(/notes\/practices\/([a-z-]+\.md)/gu)) {
                expect(practiceFileNames, `${note.fileName} links ${match[1]}`).toContain(match[1]);
            }
        }
    });
});
