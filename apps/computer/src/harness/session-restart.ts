import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const restartRequestFileName = 'restart-requested';

export async function requestSessionRestart(agentRoot: string): Promise<void> {
    const runtimeDir = join(agentRoot, 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    await writeFile(join(runtimeDir, restartRequestFileName), '', { mode: 0o600 });
}

export async function isSessionRestartRequested(agentRoot: string): Promise<boolean> {
    try {
        await readFile(join(agentRoot, 'runtime', restartRequestFileName));
        return true;
    } catch (cause) {
        if (isEnoent(cause)) {
            return false;
        }
        throw cause;
    }
}

export async function clearSessionRestartRequest(agentRoot: string): Promise<void> {
    await rm(join(agentRoot, 'runtime', restartRequestFileName), { force: true });
}

function isEnoent(cause: unknown): boolean {
    return (
        typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ENOENT'
    );
}
