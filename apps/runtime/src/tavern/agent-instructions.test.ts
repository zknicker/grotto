import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AgentRuntimeAgent } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import {
    agentSessionInstructionsFresh,
    buildAgentInstructionBundle,
    buildAgentInstructions,
} from './agent-instructions.ts';
import { recordAgentSessionInstructionsHash, startNewAgentSession } from './agent-session-store.ts';
import { getStoredAgent, updateStoredAgent, upsertStoredAgent } from './agents-store.ts';

const now = '2026-06-29T12:00:00.000Z';

// Prompt CONTENT is guarded by agent-prompt-contract.test.ts; this suite
// covers composition mechanics, the description-fed initial role, and the
// session freshness fingerprint.
describe('agent instructions', () => {
    let skillsDir: string;
    let workspaceDir: string;

    beforeEach(async () => {
        skillsDir = await mkdtemp(path.join(tmpdir(), 'tavern-agent-skills-'));
        workspaceDir = await mkdtemp(path.join(tmpdir(), 'tavern-agent-workspace-'));
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        await Promise.all([
            rm(skillsDir, { force: true, recursive: true }),
            rm(workspaceDir, { force: true, recursive: true }),
        ]);
    });

    it('composes the Raft-template body for the harness', async () => {
        const instructions = await buildAgentInstructions(
            executorInput({ workspaceFolder: workspaceDir }),
            { db: getDb(), skillsDir }
        );

        expect(instructions).toMatch(/^You are "Tavern", an AI agent in Grotto/u);
        expect(instructions).toContain('## Communication — grotto CLI ONLY');
        expect(instructions).toContain(`- Workspace: ${workspaceDir}`);
    });

    it('feeds the agent description into the initial role (W2)', async () => {
        const instructions = await buildAgentInstructions(
            executorInput({ bio: 'Release manager for Grotto.', workspaceFolder: workspaceDir }),
            { db: getDb(), skillsDir }
        );

        expect(instructions).toContain(
            '## Initial role\n\nRelease manager for Grotto. This may evolve.'
        );
    });

    it('reports session instructions freshness against the live compose', async () => {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: true,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder: workspaceDir,
            },
        });
        const session = startNewAgentSession({ agentId: 'agt_primary' });

        // No instructions delivered yet: fresh by construction.
        expect(await agentSessionInstructionsFresh(session)).toBeNull();

        const agent = getStoredAgent('agt_primary');
        if (!agent) {
            throw new Error('Agent was not stored.');
        }
        const bundle = await buildAgentInstructionBundle(
            { agent, agentSession: session },
            { seedSkills: false }
        );
        recordAgentSessionInstructionsHash({ hash: bundle.fingerprint, id: session.id });
        expect(await agentSessionInstructionsFresh(session)).toBe(true);

        updateStoredAgent({ agentId: 'agt_primary', webAccessEnabled: true });
        expect(await agentSessionInstructionsFresh(session)).toBe(false);
    });

    it.each([
        'gpt-5.5',
        'gemini-2.5-pro',
        'claude-opus-4-8',
    ])('adds no model-specific steering for %s', async (model) => {
        const instructions = await buildAgentInstructions(
            executorInput({ workspaceFolder: workspaceDir }, model),
            { db: getDb(), skillsDir }
        );

        expect(instructions).not.toContain('## Tool-Use Enforcement');
        expect(instructions).not.toContain('## Execution Discipline');
        expect(instructions).not.toContain('## Operational Directives');
    });

    it('keeps assigned skills out of the instruction text (W2)', async () => {
        const instructions = await buildAgentInstructions(
            executorInput({
                enabledSkillIds: ['research'],
                workspaceFolder: workspaceDir,
            }),
            { db: getDb(), seedSkills: false }
        );

        expect(instructions).toContain('You are "Tavern"');
        expect(instructions).not.toContain('## Skill: research');
        expect(instructions).not.toContain('SKILL.md');
        expect(instructions).not.toContain('## Skills');
    });
});

function executorInput(
    agentOverrides: Partial<AgentRuntimeAgent> = {},
    model = 'gpt-4.1-mini'
): AgentExecutorInput {
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: '.tavern/agents/agt_primary/workspace',
            ...agentOverrides,
        } satisfies AgentRuntimeAgent,
        agentSession: {
            agentId: 'agt_primary',
            archivedAt: null,
            createdAt: now,
            effectiveModel: { model, provider: 'openai' },
            generation: 1,
            id: 'ags_agt_primary_1',
            lastTurnAt: null,
            resumeState: null,
            runtimeSessionId: null,
            status: 'active',
            updatedAt: now,
        },
        prompt: 'hello',
        runId: 'run_1',
    };
}
