import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exposeHausComputerCommand } from './haus-command.ts';

test('an upgraded legacy installation exposes Haus without moving its updater destination', async () => {
    const home = await mkdtemp(join(tmpdir(), 'haus-command-'));
    const bin = join(home, '.local', 'bin');
    try {
        await mkdir(bin, { recursive: true });
        const executable = join(bin, 'grotto-computer');
        await writeFile(executable, 'signed binary');
        await exposeHausComputerCommand({ executable, home });
        await exposeHausComputerCommand({ executable, home });
        expect(await readlink(join(bin, 'haus-computer'))).toBe('grotto-computer');
        expect(await readFile(join(bin, 'haus-computer'), 'utf8')).toBe('signed binary');
        await rm(join(bin, 'haus-computer'));
        await writeFile(join(bin, 'haus-computer'), 'existing installation');
        await exposeHausComputerCommand({ executable, home });
        expect(await readFile(join(bin, 'haus-computer'), 'utf8')).toBe('existing installation');
    } finally {
        await rm(home, { recursive: true, force: true });
    }
});

test('artifact verification and custom install paths never create a global command alias', async () => {
    const home = await mkdtemp(join(tmpdir(), 'haus-command-isolation-'));
    try {
        await exposeHausComputerCommand({ executable: '/tmp/release/grotto-computer', home });
        await expect(readlink(join(home, '.local', 'bin', 'haus-computer'))).rejects.toMatchObject({
            code: 'ENOENT',
        });
    } finally {
        await rm(home, { recursive: true, force: true });
    }
});
