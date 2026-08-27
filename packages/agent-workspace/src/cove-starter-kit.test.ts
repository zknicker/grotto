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
        /integration login|local chat history|save-as-a-skill|grotto-agent/iu
    );
    expect(corpus.join('\n')).not.toContain('recipes/playbook/agent-creation');
    expect(corpus.join('\n')).toContain('grotto action prepare');
    expect(corpus.join('\n')).toContain(
        'Do not just describe or list copyable specs once action cards are available'
    );
    expect(corpus.join('\n')).toContain(
        'Only ask one blocking question first if the answer is required'
    );
    expect(corpus.join('\n')).toMatch(
        /real-work[\s\S]*starter-team[\s\S]*workstream-chats[\s\S]*effective-collaboration/u
    );
});

test('preserves the Cindy factory guidance shape with only supported Grotto actions', async () => {
    await seedCoveWorkspace(workspaceDir);

    const memory = await fs.readFile(path.join(workspaceDir, 'MEMORY.md'), 'utf8');
    const playbook = await fs.readFile(path.join(workspaceDir, 'onboarding_playbook.md'), 'utf8');
    const faq = await fs.readFile(path.join(workspaceDir, 'onboarding_knowledge_faq.md'), 'utf8');
    const objectives = await fs.readFile(
        path.join(workspaceDir, 'onboarding_objectives.md'),
        'utf8'
    );

    for (const heading of [
        '## Role',
        '## Core Goals',
        '## What Grotto Is (Practical Definition)',
        '## Decision Principles',
        '## Tone Principles',
        '## Behavioral Invariant',
        '## Knowledge Index',
        '## Success Criteria',
    ]) {
        expect(memory).toContain(heading);
    }
    for (const heading of [
        '## Step 1: Open Practical',
        '## Step 2: Activate or Propose',
        '## Step 3: Route by Intent',
        '### Starter Plan Output',
        '### Capability Boundary Pivot',
        '### Active-Elsewhere Handoff',
        '## Step 4: Progress Setup (Soft Guidance)',
        '## Team-Shape Flexibility Principle',
        '## Step 5: End Every Turn with One Next Step',
        '## Inspiration Stories',
        '## Operational Guardrails',
    ]) {
        expect(playbook).toContain(heading);
    }
    expect(playbook).toContain('Grotto action-card v1 supports Agent creation only');
    expect(playbook).toContain('let an Owner or Admin perform the unsupported mutation');
    expect(faq.match(/^## /gmu)).toHaveLength(15);
    expect(faq).toContain('How do I create Agents or Chats?');
    expect(objectives).toContain(
        'Status values are exactly: `todo`, `done`, `skipped`, `later`, `blocked`'
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
