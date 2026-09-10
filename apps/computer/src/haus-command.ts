import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

export async function exposeHausComputerCommand(input: { executable: string; home: string }) {
    const bin = join(input.home, '.local', 'bin');
    if (input.executable !== join(bin, 'grotto-computer')) {
        return;
    }
    try {
        await symlink('grotto-computer', join(bin, 'haus-computer'));
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
            throw error;
        }
    }
}
