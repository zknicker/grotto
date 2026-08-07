import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seedAgentWorkspace } from './starter-kit.ts';

describe('ordinary Agent workspace seed', () => {
    let workspaceDir = '';

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-starter-kit-'));
    });

    afterEach(async () => {
        await fs.rm(workspaceDir, { force: true, recursive: true });
    });

    it('seeds only a minimal MEMORY.md into a fresh workspace', async () => {
        const seeded = await seedAgentWorkspace({
            agentName: 'scout',
            bio: 'Operator — ships scoped, verified changes end to end',
            workspaceDir,
        });

        expect(seeded).toBe(true);
        const memory = await fs.readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8');
        expect(memory).toMatch(/^# scout\n/u);
        expect(memory).toContain('Operator — ships scoped, verified changes end to end');
        expect(memory).toContain('## Key Knowledge\n\nNo accumulated knowledge yet.');
        expect(memory).toContain('## Active Context');
        expect(memory).not.toContain('notes/');
        expect(await fs.readdir(workspaceDir)).toEqual(['MEMORY.md']);
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
});
