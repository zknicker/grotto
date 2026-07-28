import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listWorkspaceFiles, readWorkspaceFile } from './workspace-files.ts';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('ports Runtime workspace browsing while confining Computer-local reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-workspace-'));
    roots.push(root);
    const workspace = join(root, 'workspace');
    const outside = join(root, 'outside.md');
    await mkdir(join(workspace, 'notes'), { recursive: true });
    await Promise.all([
        writeFile(join(workspace, 'MEMORY.md'), '# Memory'),
        writeFile(join(workspace, '.env'), 'TOKEN=secret'),
        writeFile(join(workspace, 'notes', 'today.md'), 'Today'),
        writeFile(outside, 'outside'),
    ]);
    await symlink(outside, join(workspace, 'escape.md'));
    const canonicalWorkspace = await realpath(workspace);

    const listed = await listWorkspaceFiles(canonicalWorkspace, '');
    expect(listed.entries.map((entry) => entry.name)).toEqual(['notes', 'MEMORY.md']);
    expect((await readWorkspaceFile(canonicalWorkspace, 'MEMORY.md')).content).toBe('# Memory');
    await expect(readWorkspaceFile(canonicalWorkspace, '.env')).rejects.toThrow(
        'blocked because it may contain secrets'
    );
    await expect(readWorkspaceFile(canonicalWorkspace, 'escape.md')).rejects.toThrow(
        'must stay inside the workspace'
    );
    await expect(readWorkspaceFile(canonicalWorkspace, '../outside.md')).rejects.toThrow(
        'must stay inside the workspace'
    );
});
