import { afterEach, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openAttachmentRoot } from './attachment-root.ts';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('creates a private absolute root and derives only fixed digest leaves', async () => {
    const parent = await temporaryDirectory();
    const rootPath = join(parent, 'attachments');
    const root = await openAttachmentRoot(rootPath);

    expect((await lstat(rootPath)).mode & 0o777).toBe(0o700);
    expect(root.objectKey('srv_1234567890abcdef', 'att_1234567890abcdef')).toMatch(
        /^servers\/[a-f0-9]{64}\/objects\/[a-f0-9]{64}$/u
    );
});

test('rejects relative, symlinked, and substituted layout roots', async () => {
    await expect(openAttachmentRoot('relative/attachments')).rejects.toThrow(/absolute/i);

    const parent = await temporaryDirectory();
    const target = join(parent, 'target');
    const linkedRoot = join(parent, 'linked');
    await mkdir(target);
    await symlink(target, linkedRoot);
    await expect(openAttachmentRoot(linkedRoot)).rejects.toThrow(/symbolic link/i);

    const rootPath = join(parent, 'attachments');
    const opened = await openAttachmentRoot(rootPath);
    await rm(join(rootPath, 'servers'), { recursive: true });
    await symlink(target, join(rootPath, 'servers'));
    await expect(opened.listKeys('srv_1234567890abcdef')).rejects.toThrow(/symbolic link/i);
    await expect(openAttachmentRoot(rootPath)).rejects.toThrow(/symbolic link/i);
});

test('rejects traversal, encoded separators, absolute ids, and foreign id shapes', async () => {
    const parent = await temporaryDirectory();
    const root = await openAttachmentRoot(join(parent, 'attachments'));

    for (const value of ['../outside', '%2foutside', '/outside', 'srv_wrong']) {
        expect(() => root.objectKey(value, 'att_1234567890abcdef')).toThrow(/invalid Server id/i);
    }
    for (const value of ['../outside', '%5coutside', '/outside', 'att_wrong']) {
        expect(() => root.objectKey('srv_1234567890abcdef', value)).toThrow(
            /invalid attachment id/i
        );
    }
});

test('fails closed when an expected staging or object leaf is substituted', async () => {
    const parent = await temporaryDirectory();
    const root = await openAttachmentRoot(join(parent, 'attachments'));
    const serverId = 'srv_1234567890abcdef';
    const attachmentId = 'att_1234567890abcdef';
    const stagingKey = 'upl_1234567890abcdef';
    const staged = await root.createStagingFile(serverId, stagingKey);
    await staged.write('safe');
    await staged.close();

    const inventory = await root.listKeys(serverId);
    const objectPath = join(root.path, root.objectKey(serverId, attachmentId));
    const stagingPath = join(root.path, inventory.stagingKeys[0]);
    const external = join(parent, 'external');
    await writeFile(external, 'foreign');

    await rm(stagingPath);
    await symlink(external, stagingPath);
    await expect(root.finalize(serverId, attachmentId, stagingKey)).rejects.toThrow(
        /non-symlink regular file/i
    );

    await rm(stagingPath);
    const replacement = await root.createStagingFile(serverId, stagingKey);
    await replacement.close();
    await symlink(external, objectPath);
    await expect(root.finalize(serverId, attachmentId, stagingKey)).rejects.toThrow(
        /already exists/i
    );
    await expect(root.openObject(serverId, attachmentId)).rejects.toThrow();
});

async function temporaryDirectory() {
    const root = await mkdtemp(join(tmpdir(), 'grotto-attachment-root-'));
    roots.push(root);
    return root;
}
