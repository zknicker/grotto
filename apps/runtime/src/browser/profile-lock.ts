import fs from 'node:fs';
import path from 'node:path';

// Cross-process profile ownership via a pidfile with a liveness check: a
// second Runtime (or an operator command) refuses to write the same profile
// while the recorded owner process is still alive. Stale locks from crashed
// owners are reclaimed.
export class ProfileLock {
    private readonly lockPath: string;
    private held = false;

    constructor(lockPath: string) {
        this.lockPath = lockPath;
    }

    get isHeld(): boolean {
        return this.held;
    }

    acquire(): void {
        if (this.held) {
            return;
        }
        fs.mkdirSync(path.dirname(this.lockPath), { mode: 0o700, recursive: true });
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const descriptor = fs.openSync(this.lockPath, 'wx', 0o600);
                fs.writeSync(descriptor, `${process.pid}\n`);
                fs.closeSync(descriptor);
                this.held = true;
                return;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                    throw error;
                }
                const owner = this.readOwnerPid();
                if (owner === process.pid) {
                    this.held = true;
                    return;
                }
                if (owner !== null && isProcessAlive(owner)) {
                    throw new Error(`Browser profile is locked by another process (pid ${owner}).`);
                }
                // Stale lock from a dead owner: reclaim it.
                try {
                    fs.unlinkSync(this.lockPath);
                } catch {
                    // Another contender may have reclaimed first; retry once.
                }
            }
        }
        throw new Error('Browser profile lock could not be acquired.');
    }

    release(): void {
        if (!this.held) {
            return;
        }
        this.held = false;
        try {
            if (this.readOwnerPid() === process.pid) {
                fs.unlinkSync(this.lockPath);
            }
        } catch {
            // A missing lock file means there is nothing left to release.
        }
    }

    private readOwnerPid(): number | null {
        try {
            const pid = Number.parseInt(fs.readFileSync(this.lockPath, 'utf8').trim(), 10);
            return Number.isInteger(pid) && pid > 0 ? pid : null;
        } catch {
            return null;
        }
    }
}

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
}
