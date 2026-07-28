import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function withUpdateLock<Result>(
    dataRoot: string,
    operation: () => Promise<Result>
): Promise<Result> {
    const lock = join(dataRoot, 'update-admission.lock');
    await mkdir(dataRoot, { mode: 0o700, recursive: true });
    for (;;) {
        try {
            await mkdir(lock, { mode: 0o700 });
            await writeFile(join(lock, 'pid'), `${process.pid}\n`, { mode: 0o600 });
            break;
        } catch (cause) {
            if (!(cause instanceof Error && 'code' in cause && cause.code === 'EEXIST')) {
                throw cause;
            }
            await clearStaleLock(lock);
            await Bun.sleep(20);
        }
    }
    try {
        return await operation();
    } finally {
        await rm(lock, { force: true, recursive: true });
    }
}

export async function tryAcquirePidLock(lock: string): Promise<(() => Promise<void>) | null> {
    await mkdir(dirname(lock), { mode: 0o700, recursive: true });
    for (;;) {
        try {
            await writeFile(lock, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
            return async () => await rm(lock, { force: true });
        } catch (cause) {
            if (!(cause instanceof Error && 'code' in cause && cause.code === 'EEXIST')) {
                throw cause;
            }
            if (!(await removeDeadLockFile(lock))) {
                return null;
            }
        }
    }
}

async function clearStaleLock(lock: string) {
    try {
        const pid = Number.parseInt(await readFile(join(lock, 'pid'), 'utf8'), 10);
        process.kill(pid, 0);
    } catch (cause) {
        if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
            return;
        }
        await rm(lock, { force: true, recursive: true });
    }
}

async function removeDeadLockFile(lock: string) {
    try {
        const pid = Number.parseInt(await readFile(lock, 'utf8'), 10);
        process.kill(pid, 0);
        return false;
    } catch (cause) {
        if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
            return true;
        }
        await rm(lock, { force: true });
        return true;
    }
}
