import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { type FileHandle, lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

const serverIdPattern = /^srv_[A-Za-z0-9_-]{16}$/u;
const attachmentIdPattern = /^att_[A-Za-z0-9_-]{16}$/u;
const stagingKeyPattern = /^upl_[A-Za-z0-9_-]{16}$/u;

export interface AttachmentRoot {
    createStagingFile(serverId: string, stagingKey: string): Promise<FileHandle>;
    discardStagingFile(serverId: string, stagingKey: string): Promise<void>;
    finalize(serverId: string, attachmentId: string, stagingKey: string): Promise<void>;
    listKeys(serverId: string): Promise<{ objectKeys: string[]; stagingKeys: string[] }>;
    objectKey(serverId: string, attachmentId: string): string;
    openObject(serverId: string, attachmentId: string): Promise<FileHandle>;
    openStagingFile(serverId: string, stagingKey: string): Promise<FileHandle>;
    path: string;
    stagingKey(serverId: string, stagingKey: string): string;
}

export interface AttachmentRootFailureInjection {
    afterRename?(): Promise<void> | void;
}

export async function openAttachmentRoot(
    rootPath: string,
    failureInjection?: AttachmentRootFailureInjection
): Promise<AttachmentRoot> {
    if (!isAbsolute(rootPath)) {
        throw new Error('The attachment root must be an absolute path.');
    }

    await mkdir(rootPath, { mode: 0o700, recursive: true });
    await requirePrivateDirectory(rootPath, 'attachment root');

    const serversPath = join(rootPath, 'servers');
    await mkdir(serversPath, { mode: 0o700, recursive: true });
    await requirePrivateDirectory(serversPath, 'attachment servers directory');

    const attachmentRoot: AttachmentRoot = {
        async createStagingFile(serverId, stagingKey) {
            const paths = await ensureServerLayout(rootPath, serverId);
            requireId(stagingKey, stagingKeyPattern, 'staging');
            return await openRegularLeaf(join(paths.staging, digest(stagingKey)), true);
        },
        async discardStagingFile(serverId, stagingKey) {
            const paths = await ensureServerLayout(rootPath, serverId);
            requireId(stagingKey, stagingKeyPattern, 'staging');
            if (await unlinkRegularLeaf(join(paths.staging, digest(stagingKey)))) {
                await syncDirectory(paths.staging);
            }
        },
        async finalize(serverId, attachmentId, stagingKey) {
            const paths = await ensureServerLayout(rootPath, serverId);
            requireId(attachmentId, attachmentIdPattern, 'attachment');
            requireId(stagingKey, stagingKeyPattern, 'staging');
            const stagingPath = join(paths.staging, digest(stagingKey));
            const objectPath = join(paths.objects, digest(`${serverId}\0${attachmentId}`));
            await requireRegularLeaf(stagingPath);
            await requireAbsentLeaf(objectPath);
            await rename(stagingPath, objectPath);
            await failureInjection?.afterRename?.();
            await syncDirectory(paths.objects);
            await syncDirectory(paths.staging);
        },
        async listKeys(serverId) {
            const paths = await ensureServerLayout(rootPath, serverId);
            return {
                objectKeys: (await listRegularLeafNames(paths.objects)).map((name) =>
                    relative(rootPath, join(paths.objects, name))
                ),
                stagingKeys: (await listRegularLeafNames(paths.staging)).map((name) =>
                    relative(rootPath, join(paths.staging, name))
                ),
            };
        },
        objectKey(serverId, attachmentId) {
            requireId(serverId, serverIdPattern, 'Server');
            requireId(attachmentId, attachmentIdPattern, 'attachment');

            return relative(
                rootPath,
                join(
                    serversPath,
                    digest(serverId),
                    'objects',
                    digest(`${serverId}\0${attachmentId}`)
                )
            );
        },
        async openObject(serverId, attachmentId) {
            const paths = await ensureServerLayout(rootPath, serverId);
            requireId(attachmentId, attachmentIdPattern, 'attachment');
            return await openRegularLeaf(
                join(paths.objects, digest(`${serverId}\0${attachmentId}`)),
                false
            );
        },
        async openStagingFile(serverId, stagingKey) {
            const paths = await ensureServerLayout(rootPath, serverId);
            requireId(stagingKey, stagingKeyPattern, 'staging');
            return await openRegularLeaf(join(paths.staging, digest(stagingKey)), false);
        },
        path: rootPath,
        stagingKey(serverId, stagingKey) {
            requireId(serverId, serverIdPattern, 'Server');
            requireId(stagingKey, stagingKeyPattern, 'staging');
            return relative(
                rootPath,
                join(rootPath, 'servers', digest(serverId), 'staging', digest(stagingKey))
            );
        },
    };

    return attachmentRoot;
}

async function requirePrivateDirectory(path: string, label: string) {
    const stat = await lstat(path);

    if (stat.isSymbolicLink()) {
        throw new Error(`The ${label} cannot be a symbolic link.`);
    }
    if (!stat.isDirectory()) {
        throw new Error(`The ${label} must be a directory.`);
    }
    if ((stat.mode & 0o777) !== 0o700) {
        throw new Error(`The ${label} must have mode 0700.`);
    }
}

async function ensureServerLayout(rootPath: string, serverId: string) {
    requireId(serverId, serverIdPattern, 'Server');
    await requirePrivateDirectory(rootPath, 'attachment root');
    const serversPath = join(rootPath, 'servers');
    await requirePrivateDirectory(serversPath, 'attachment servers directory');
    const serverPath = join(serversPath, digest(serverId));
    const objects = join(serverPath, 'objects');
    const staging = join(serverPath, 'staging');

    for (const path of [serverPath, objects, staging]) {
        await mkdir(path, { mode: 0o700, recursive: true });
        await requirePrivateDirectory(path, 'attachment layout directory');
    }

    return { objects, staging };
}

async function openRegularLeaf(path: string, create: boolean) {
    const flags = create
        ? constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW
        : constants.O_RDONLY | constants.O_NOFOLLOW;
    const file = await open(path, flags, 0o600);
    const stat = await file.stat();

    if (!stat.isFile()) {
        await file.close();
        throw new Error('Attachment leaf must be a regular file.');
    }

    return file;
}

async function requireRegularLeaf(path: string) {
    const stat = await lstat(path);

    if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error('Attachment leaf must be a non-symlink regular file.');
    }
}

async function requireAbsentLeaf(path: string) {
    try {
        await lstat(path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return;
        }
        throw error;
    }

    throw new Error('Attachment object leaf already exists.');
}

async function unlinkRegularLeaf(path: string) {
    try {
        await requireRegularLeaf(path);
        await unlink(path);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
        return false;
    }
}

async function listRegularLeafNames(path: string) {
    const entries = await readdir(path, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile() || entry.isSymbolicLink() || !/^[a-f0-9]{64}$/u.test(entry.name)) {
            throw new Error('Attachment layout contains an unexpected leaf.');
        }
    }

    return entries.map((entry) => entry.name).sort();
}

async function syncDirectory(path: string) {
    const directory = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);

    try {
        await directory.sync();
    } finally {
        await directory.close();
    }
}

function requireId(value: string, pattern: RegExp, kind: string) {
    if (!pattern.test(value)) {
        throw new Error(`Invalid ${kind} id.`);
    }
}

function digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
}
