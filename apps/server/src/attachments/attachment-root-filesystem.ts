import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const serverIdPattern = /^srv_[A-Za-z0-9_-]{16}$/u;

export async function requirePrivateDirectory(path: string, label: string) {
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

export async function requirePrivateDirectoryIfPresent(path: string, label: string) {
    try {
        await requirePrivateDirectory(path, label);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

export async function ensureServerLayout(rootPath: string, serverId: string) {
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

export async function openRegularLeaf(path: string, create: boolean) {
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

export async function requireRegularLeaf(path: string) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error('Attachment leaf must be a non-symlink regular file.');
    }
}

export async function requireAbsentLeaf(path: string) {
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

export async function unlinkRegularLeaf(path: string) {
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

export async function listRegularLeafNames(path: string) {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile() || entry.isSymbolicLink() || !/^[a-f0-9]{64}$/u.test(entry.name)) {
            throw new Error('Attachment layout contains an unexpected leaf.');
        }
    }
    return entries.map((entry) => entry.name).sort();
}

export async function syncDirectory(path: string) {
    const directory = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        await directory.sync();
    } finally {
        await directory.close();
    }
}

export function requireId(value: string, pattern: RegExp, kind: string) {
    if (!pattern.test(value)) {
        throw new Error(`Invalid ${kind} id.`);
    }
}

export function digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
}
