import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { listWorkspaceFiles, readWorkspaceFile } from './files';
import { registerAgentWorkspace } from './instructions';

describe('workspace files', () => {
    let outsideDir: string;
    let workspaceDir: string;

    beforeEach(async () => {
        workspaceDir = await mkdtemp(path.join(tmpdir(), 'tavern-workspace-files-'));
        outsideDir = await mkdtemp(path.join(tmpdir(), 'tavern-workspace-outside-'));
        ensureRuntimeSchema(initTestDb());
        registerAgentWorkspace(getDb(), {
            agentId: 'planner',
            agentName: 'Planner',
            workspaceDir,
        });
    });

    afterEach(async () => {
        closeDb();
        await rm(workspaceDir, { force: true, recursive: true });
        await rm(outsideDir, { force: true, recursive: true });
    });

    test('lists visible workspace files with directories first', async () => {
        await mkdir(path.join(workspaceDir, 'docs'));
        await mkdir(path.join(workspaceDir, 'node_modules'));
        await mkdir(path.join(workspaceDir, '.drafts'));
        await mkdir(path.join(workspaceDir, '.git'));
        await mkdir(path.join(workspaceDir, 'codex-ags_cht_general_agt_primary_1'));
        await mkdir(path.join(workspaceDir, 'claude-code-ags_cht_general_agt_primary_2'));
        await writeFile(path.join(workspaceDir, 'README.md'), '# Hello');
        await writeFile(path.join(workspaceDir, '.env'), 'SECRET=1');
        await writeFile(path.join(workspaceDir, '.drafts', 'plan.md'), '# Plan');
        await writeFile(path.join(workspaceDir, 'docs', 'plan.html'), '<h1>Plan</h1>');

        const root = await listWorkspaceFiles(getDb(), { agentId: 'planner', path: '' });
        const docs = await listWorkspaceFiles(getDb(), { agentId: 'planner', path: 'docs' });

        expect(root.entries.map((entry) => entry.path)).toEqual(['docs', 'README.md']);
        expect(root.entries[0]).toMatchObject({ kind: 'directory', mediaType: null });
        expect(root.entries[1]).toMatchObject({
            kind: 'file',
            mediaType: 'text/markdown',
            sizeBytes: 7,
        });
        expect(docs.entries).toMatchObject([
            { kind: 'file', mediaType: 'text/html', name: 'plan.html', path: 'docs/plan.html' },
        ]);

        const hidden = await listWorkspaceFiles(getDb(), {
            agentId: 'planner',
            includeHidden: true,
            path: '',
        });
        expect(hidden.entries.map((entry) => entry.path)).toEqual(['.drafts', 'docs', 'README.md']);
        await expect(
            listWorkspaceFiles(getDb(), {
                agentId: 'planner',
                includeHidden: true,
                path: '.git',
            })
        ).rejects.toThrow(/not browseable/u);
        await expect(
            readWorkspaceFile(getDb(), {
                agentId: 'planner',
                includeHidden: true,
                path: '.drafts/plan.md',
            })
        ).resolves.toMatchObject({ content: '# Plan' });
    });

    test('reads markdown, html, and image content from the registered workspace', async () => {
        await mkdir(path.join(workspaceDir, 'out'));
        await writeFile(path.join(workspaceDir, 'notes.md'), '# Notes');
        await writeFile(path.join(workspaceDir, 'out', 'preview.html'), '<h1>Preview</h1>');
        await writeFile(path.join(workspaceDir, 'pixel.png'), Buffer.from([137, 80, 78, 71]));

        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'notes.md' })
        ).resolves.toMatchObject({
            binary: false,
            content: '# Notes',
            encoding: 'utf8',
            mediaType: 'text/markdown',
        });
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'out/preview.html' })
        ).resolves.toMatchObject({
            binary: false,
            content: '<h1>Preview</h1>',
            mediaType: 'text/html',
        });
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'pixel.png' })
        ).resolves.toMatchObject({
            binary: true,
            content: 'iVBORw==',
            encoding: 'base64',
            mediaType: 'image/png',
        });
    });

    test('reads html completely past the text preview window, capped at 5 MiB', async () => {
        const largeHtml = `<html><body>${'x'.repeat(700 * 1024)}</body></html>`;
        await writeFile(path.join(workspaceDir, 'large.html'), largeHtml);
        await writeFile(path.join(workspaceDir, 'large.txt'), 'y'.repeat(700 * 1024));
        await writeFile(
            path.join(workspaceDir, 'huge.html'),
            `<html>${'z'.repeat(6 * 1024 * 1024)}`
        );

        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'large.html' })
        ).resolves.toMatchObject({ content: largeHtml, truncated: false });
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'large.txt' })
        ).resolves.toMatchObject({ truncated: true });
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'huge.html' })
        ).resolves.toMatchObject({ truncated: true });
    });

    test('rejects traversal, symlinks, and sensitive files', async () => {
        await mkdir(path.join(workspaceDir, '.home', '.codex'), { recursive: true });
        await mkdir(path.join(workspaceDir, 'codex-ags_cht_general_agt_primary_1'));
        await mkdir(path.join(workspaceDir, 'node_modules', 'package'), { recursive: true });
        await writeFile(path.join(workspaceDir, '.env'), 'SECRET=1');
        await writeFile(
            path.join(workspaceDir, '.home', '.codex', 'auth.json'),
            '{"token":"secret"}'
        );
        await writeFile(
            path.join(workspaceDir, 'codex-ags_cht_general_agt_primary_1', 'harness-tool.mjs'),
            'token'
        );
        await writeFile(path.join(workspaceDir, 'node_modules', 'package', 'index.js'), 'code');
        await writeFile(path.join(outsideDir, 'secret.md'), '# Secret');
        await symlink(
            path.join(outsideDir, 'secret.md'),
            path.join(workspaceDir, 'secret-link.md')
        );

        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: '../secret.md' })
        ).rejects.toThrow(/inside the workspace|required|relative/u);
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: '.env' })
        ).rejects.toThrow(/secrets/u);
        await expect(
            listWorkspaceFiles(getDb(), { agentId: 'planner', path: '.home/.codex' })
        ).rejects.toThrow(/not browseable/u);
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: '.home/.codex/auth.json' })
        ).rejects.toThrow(/secrets|key material/u);
        await expect(
            listWorkspaceFiles(getDb(), {
                agentId: 'planner',
                path: 'codex-ags_cht_general_agt_primary_1',
            })
        ).rejects.toThrow(/not browseable/u);
        await expect(
            readWorkspaceFile(getDb(), {
                agentId: 'planner',
                path: 'codex-ags_cht_general_agt_primary_1/harness-tool.mjs',
            })
        ).rejects.toThrow(/not browseable/u);
        await expect(
            listWorkspaceFiles(getDb(), { agentId: 'planner', path: 'node_modules/package' })
        ).rejects.toThrow(/not browseable/u);
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'secret-link.md' })
        ).rejects.toThrow(/inside the workspace/u);
    });
});
