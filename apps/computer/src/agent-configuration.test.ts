import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyAgentConfiguration, parseAgentConfigureCommand } from './agent-configuration.ts';
import { readEffectiveAgentStates } from './effective-state.ts';

let dataRoot: string;

beforeEach(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), 'grotto-agent-configuration-'));
});

afterEach(async () => {
    await rm(dataRoot, { force: true, recursive: true });
});

test('applies desired runtime and model without waiting for the first turn', async () => {
    const command = parseAgentConfigureCommand({
        agentDescription: 'Reviews launch copy and records concrete risks.',
        agentId: 'agt_configurationxxx',
        agentName: 'Scout',
        modelId: 'gpt-5.6-sol',
        runtimeId: 'codex',
        sessionGeneration: 1,
        sessionResetKind: 'full',
        type: 'agent-configure',
    });
    if (!command) {
        throw new Error('Fixture command did not parse.');
    }

    await applyAgentConfiguration({
        command,
        dataRoot,
        inventory: {
            runtimes: [
                {
                    id: 'codex',
                    label: 'Codex',
                    models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
                },
            ],
        },
        serverId: 'srv_configuration',
    });

    expect(await readEffectiveAgentStates(dataRoot, 'srv_configuration')).toEqual([
        {
            agentId: 'agt_configurationxxx',
            missingResources: [],
            modelId: 'gpt-5.6-sol',
            runtimeId: 'codex',
        },
    ]);
    for (const directory of ['home', 'runtime', 'skills', 'workspace']) {
        expect(
            (
                await stat(
                    join(
                        dataRoot,
                        'servers',
                        'srv_configuration',
                        'agents',
                        command.agentId,
                        directory
                    )
                )
            ).isDirectory()
        ).toBe(true);
    }
    const workspace = join(
        dataRoot,
        'servers',
        'srv_configuration',
        'agents',
        command.agentId,
        'workspace'
    );
    expect(await readFile(join(workspace, 'MEMORY.md'), 'utf8')).toContain(
        'Reviews launch copy and records concrete risks.'
    );
    await expect(stat(join(workspace, 'notes'))).rejects.toThrow();
    expect(await readdir(workspace)).toEqual(['MEMORY.md']);
    const skills = join(
        dataRoot,
        'servers',
        'srv_configuration',
        'agents',
        command.agentId,
        'skills'
    );
    await expect(readFile(join(skills, 'tavern-agent', 'SKILL.md'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(skills, 'visuals', 'SKILL.md'), 'utf8')).resolves.toContain(
        'name: visuals'
    );
});

test('reports a missing desired model instead of substituting one', async () => {
    const command = parseAgentConfigureCommand({
        agentDescription: null,
        agentId: 'agt_missingmodelxxxx',
        agentName: 'Missing',
        modelId: 'missing-model',
        runtimeId: 'codex',
        sessionGeneration: 1,
        sessionResetKind: 'full',
        type: 'agent-configure',
    });
    if (!command) {
        throw new Error('Fixture command did not parse.');
    }

    await applyAgentConfiguration({
        command,
        dataRoot,
        inventory: { runtimes: [{ id: 'codex', label: 'Codex', models: [] }] },
        serverId: 'srv_configuration',
    });

    expect(await readEffectiveAgentStates(dataRoot, 'srv_configuration')).toEqual([
        {
            agentId: 'agt_missingmodelxxxx',
            missingResources: ['model:missing-model'],
            modelId: null,
            runtimeId: 'codex',
        },
    ]);
});
