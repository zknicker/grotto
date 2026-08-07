import { mkdtempSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agentSkillsDir } from '../agent-engine/skill-library.ts';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { resetAgentSession } from './agent-session-reset.ts';
import { ensureCurrentAgentSession, readCurrentAgentSession } from './agent-session-store.ts';
import { agentTokenPath, mintAgentToken, readAgentToken } from './agent-tokens.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { listMessages } from './chat-api/index.ts';

describe('agent session reset', () => {
    let workspaceDir: string;
    let runtimeRoot: string;
    let previousRuntimeRoot: string | undefined;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        previousRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
        runtimeRoot = mkdtempSync(path.join(os.tmpdir(), 'tavern-reset-root-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        workspaceDir = mkdtempSync(path.join(os.tmpdir(), 'tavern-reset-'));
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_otto',
                isAdmin: false,
                name: 'Otto',
                primaryColor: null,
                workspaceFolder: workspaceDir,
            },
        });
        await fs.writeFile(path.join(workspaceDir, 'NOTES.md'), 'keep me');
    });

    afterEach(async () => {
        closeDb();
        process.env.TAVERN_RUNTIME_ROOT = previousRuntimeRoot;
        await fs.rm(workspaceDir, { force: true, recursive: true });
        await fs.rm(runtimeRoot, { force: true, recursive: true });
        // AGENT_HOME is frozen to the hermetic vitest root, so the skill
        // library lands outside runtimeRoot; clean it between cases.
        await fs.rm(agentSkillsDir('agt_otto'), { force: true, recursive: true });
    });

    it('session reset starts the next generation and keeps the workspace', async () => {
        const before = ensureCurrentAgentSession({ agentId: 'agt_otto' });

        const { session } = await resetAgentSession({ agentId: 'agt_otto' });

        expect(session.generation).toBe(before.generation + 1);
        expect(readCurrentAgentSession({ agentId: 'agt_otto' })?.id).toBe(session.id);
        // Workspace and memory persist (specs/sessions.md).
        await expect(fs.readFile(path.join(workspaceDir, 'NOTES.md'), 'utf8')).resolves.toBe(
            'keep me'
        );
    });

    it('session reset preserves the canonical skill library', async () => {
        ensureCurrentAgentSession({ agentId: 'agt_otto' });
        const skillsDir = agentSkillsDir('agt_otto');
        await fs.mkdir(path.join(skillsDir, 'authored'), { recursive: true });
        await fs.writeFile(path.join(skillsDir, 'authored', 'SKILL.md'), '# authored');

        await resetAgentSession({ agentId: 'agt_otto', kind: 'session' });

        // Skills persist across a session reset (specs/sessions.md).
        await expect(
            fs.readFile(path.join(skillsDir, 'authored', 'SKILL.md'), 'utf8')
        ).resolves.toBe('# authored');
    });

    it('full reset wipes the workspace back to the ordinary factory state', async () => {
        ensureCurrentAgentSession({ agentId: 'agt_otto' });

        const { session } = await resetAgentSession({ agentId: 'agt_otto', kind: 'full' });

        expect(readCurrentAgentSession({ agentId: 'agt_otto' })?.id).toBe(session.id);
        const entries = await fs.readdir(workspaceDir);
        expect(entries).toEqual(['MEMORY.md']);
        const memory = await fs.readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8');
        expect(memory).toMatch(/^# Otto\n/u);
        expect(memory).toContain('No accumulated knowledge yet.');
    });

    it('full reset recreates only the visuals factory skill', async () => {
        ensureCurrentAgentSession({ agentId: 'agt_otto' });
        const skillsDir = agentSkillsDir('agt_otto');
        await fs.mkdir(path.join(skillsDir, 'authored'), { recursive: true });
        await fs.writeFile(path.join(skillsDir, 'authored', 'SKILL.md'), '# authored');

        await resetAgentSession({ agentId: 'agt_otto', kind: 'full' });

        // The authored skill is gone; the visuals managed library is restored.
        await expect(
            fs.readFile(path.join(skillsDir, 'authored', 'SKILL.md'), 'utf8')
        ).rejects.toThrow();
        await expect(
            fs.readFile(path.join(skillsDir, 'visuals', 'SKILL.md'), 'utf8')
        ).resolves.toContain('```visual');
        await expect(
            fs.readFile(path.join(skillsDir, 'tavern-agent', 'SKILL.md'), 'utf8')
        ).rejects.toThrow();
    });

    it('records the rotation reason on the receipt', async () => {
        ensureCurrentAgentSession({ agentId: 'agt_otto' });

        await resetAgentSession({ agentId: 'agt_otto', kind: 'session' });
        await resetAgentSession({ agentId: 'agt_otto', kind: 'full' });

        const rows = listMessages('cht_agt_otto_dm', { limit: 10 });
        const reasons = rows.messages
            .filter((message) => message.role === 'system')
            .map(
                (message) => (message.metadata as { runtime?: { reason?: string } }).runtime?.reason
            );
        expect(reasons).toContain('session');
        expect(reasons).toContain('full');
    });

    it('lands a durable system receipt in the agent DM', async () => {
        ensureCurrentAgentSession({ agentId: 'agt_otto' });

        const { session } = await resetAgentSession({ agentId: 'agt_otto' });

        // The receipt lands as a system message in the agent's built-in DM
        // (bootstrapped with the agent), the agent's home surface.
        const rows = listMessages('cht_agt_otto_dm', { limit: 10 });
        const receipt = rows.messages.find((message) => message.role === 'system');
        expect(receipt?.content).toContain('Started a fresh session');
        const runtime = (receipt?.metadata as { runtime?: { notice?: string; sessionId?: string } })
            .runtime;
        expect(runtime?.notice).toBe('new_session');
        expect(runtime?.sessionId).toBe(session.id);
    });

    it('rotates the mode-0600 agent token', async () => {
        const before = mintAgentToken('agt_otto');

        await resetAgentSession({ agentId: 'agt_otto' });

        const after = readAgentToken('agt_otto');
        expect(after).toMatch(/^grta_[A-Za-z0-9_-]{43}$/u);
        expect(after).not.toBe(before);
        expect((await fs.stat(agentTokenPath('agt_otto'))).mode & 0o777).toBe(0o600);
    });
});
