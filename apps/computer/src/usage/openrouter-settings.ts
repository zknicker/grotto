import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function openRouterManagementKeyPath(dataRoot: string) {
    return join(dataRoot, 'providers', 'openrouter-management-key');
}

export async function readOpenRouterManagementKey(dataRoot: string): Promise<string | null> {
    try {
        return (await readFile(openRouterManagementKeyPath(dataRoot), 'utf8')).trim() || null;
    } catch {
        return null;
    }
}

export async function saveOpenRouterManagementKey(dataRoot: string, key: string) {
    const value = key.trim();
    if (!value) {
        throw new Error('OpenRouter management key is required.');
    }

    const providerRoot = join(dataRoot, 'providers');
    const destination = openRouterManagementKeyPath(dataRoot);
    const temporary = join(
        providerRoot,
        `.openrouter-management-key-${randomBytes(8).toString('hex')}`
    );
    await mkdir(providerRoot, { mode: 0o700, recursive: true });
    await writeFile(temporary, `${value}\n`, { mode: 0o600 });
    await rename(temporary, destination);
    await chmod(destination, 0o600);
}
