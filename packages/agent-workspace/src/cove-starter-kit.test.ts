import { afterEach, beforeEach, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getManualTopic } from '@grotto/agent-manual';
import {
    coveSeededSummaries,
    coveWorkspaceFiles,
    seedCoveWorkspace,
    validateCoveWorkspace,
} from './cove-starter-kit.ts';

let workspaceDir = '';

beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grotto-cove-workspace-'));
});

afterEach(async () => {
    await fs.rm(workspaceDir, { force: true, recursive: true });
});

test('seeds Cove exact inventory and 12 valid separately authored Manual summaries', async () => {
    const firstManifest = await seedCoveWorkspace(workspaceDir);
    const replayManifest = await seedCoveWorkspace(workspaceDir);

    expect(replayManifest).toBe(firstManifest);
    expect((await fs.readdir(workspaceDir)).sort()).toEqual(coveWorkspaceFiles);
    expect(coveSeededSummaries.map(([id]) => id)).toEqual([
        'recipes/decision/one-or-many',
        'recipes/decision/stake-strictness',
        'recipes/decision/when-to-ask-human',
        'recipes/pattern/discuss-then-assign',
        'recipes/pattern/evidence-handoff',
        'recipes/pattern/recurring-recovery',
        'recipes/technique/html-artifact-discussion',
        'recipes/technique/preview-env',
        'recipes/technique/reminder-cron',
        'recipes/technique/sent-zero',
        'recipes/technique/task-claim-lock',
        'recipes/technique/video-review',
    ]);
    for (const [id, summary] of coveSeededSummaries) {
        expect(getManualTopic(id)).toMatchObject({ id, kind: 'recipe', tier: 'seeded' });
        expect(summary.length).toBeGreaterThan(40);
    }

    const corpus = await Promise.all(
        coveWorkspaceFiles.map((name) => fs.readFile(path.join(workspaceDir, name), 'utf8'))
    );
    expect(corpus.join('\n')).not.toMatch(
        /action card|integration login|local chat history|save-as-a-skill|grotto-agent/iu
    );
    expect(corpus.join('\n')).toMatch(
        /real-work[\s\S]*starter-team[\s\S]*workstream-chats[\s\S]*effective-collaboration/u
    );
});

test('refuses to acknowledge an extra or changed workspace', async () => {
    await seedCoveWorkspace(workspaceDir);
    await fs.writeFile(path.join(workspaceDir, 'recipe.md'), '# unsupported\n');
    await expect(validateCoveWorkspace(workspaceDir)).rejects.toThrow(/inventory/u);
});

test('refuses a preexisting noncanonical Cove file instead of blessing its bytes', async () => {
    await fs.writeFile(path.join(workspaceDir, 'MEMORY.md'), '# ordinary Agent memory\n');

    await expect(seedCoveWorkspace(workspaceDir)).rejects.toThrow(/contents/u);
});
